import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import {
  adminStudentUpdateSchema,
  approveRegistrationSchema,
  assertReviewTransition,
  buildDefaultValidity,
  publicRegistrationSchema,
  registrationProfileUpdateSchema,
  rejectRegistrationSchema,
} from "@/lib/domain/student-registration";
import { hashPassword } from "@/lib/server/password";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  hashSensitiveValue,
  maskNationalId,
  maskPhone,
} from "@/lib/server/student-sensitive-data";
import { getBusinessDate } from "@/lib/server/time";

type Transaction = Prisma.TransactionClient;

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateValue(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function snapshot(input: { displayName: string; school: string | null; gradeId: string | null; gender: string | null; nationalIdLast4: string | null; phoneLast4: string | null }) {
  return {
    displayName: input.displayName,
    school: input.school,
    gradeId: input.gradeId,
    gender: input.gender,
    nationalIdLast4: input.nationalIdLast4,
    phoneLast4: input.phoneLast4,
  };
}

async function requireEnabledGrade(tx: Transaction, gradeId: string) {
  const grade = await tx.grade.findFirst({ where: { id: gradeId, enabled: true } });
  if (!grade) throw new ApiError("请选择启用的年级", 400);
  return grade;
}

async function assertUniqueStudentIdentity(tx: Transaction, input: { username?: string; nationalIdHash: string; phoneHash: string; excludeId?: string }) {
  const conflict = await tx.user.findFirst({
    where: {
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(input.username ? [{ username: input.username }] : []),
        { nationalIdHash: input.nationalIdHash },
        { phoneHash: input.phoneHash },
      ],
    },
    select: { id: true },
  });
  if (conflict) throw new ApiError("REGISTRATION_CONFLICT", 409);
}

function mapRegistrationConflict(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError("REGISTRATION_CONFLICT", 409);
  throw error;
}

export async function registerStudent(rawInput: unknown) {
  const input = publicRegistrationSchema.parse(rawInput);
  const nationalIdHash = hashSensitiveValue(input.nationalId);
  const phoneHash = hashSensitiveValue(input.phone);
  try {
    return await prisma.$transaction(async (tx) => {
      await requireEnabledGrade(tx, input.gradeId);
      await assertUniqueStudentIdentity(tx, { username: input.username, nationalIdHash, phoneHash });
      const submittedAt = new Date();
      const student = await tx.user.create({ data: {
        username: input.username,
        displayName: input.displayName,
        passwordHash: hashPassword(input.password),
        role: "STUDENT",
        enabled: true,
        mustChangePassword: false,
        studentStatus: "PENDING",
        registrationSource: "SELF_REGISTRATION",
        nationalIdEncrypted: encryptSensitiveValue(input.nationalId),
        nationalIdHash,
        nationalIdLast4: input.nationalId.slice(-4),
        gender: input.gender,
        school: input.school,
        gradeId: input.gradeId,
        phoneEncrypted: encryptSensitiveValue(input.phone),
        phoneHash,
        phoneLast4: input.phone.slice(-4),
        submittedAt,
        isLongTerm: false,
        profileIncomplete: false,
      } });
      const profileSnapshot = snapshot(student);
      await tx.studentReviewRecord.create({ data: { studentId: student.id, actorUserId: student.id, action: "SUBMITTED", beforeStatus: null, afterStatus: "PENDING", profileSnapshot } });
      await tx.auditLog.create({ data: { actorUserId: student.id, action: "STUDENT_REGISTRATION_SUBMIT", targetType: "User", targetId: student.id, metadata: profileSnapshot } });
      return { id: student.id };
    });
  } catch (error) {
    mapRegistrationConflict(error);
  }
}

export async function getRegistrationStatus(studentId: string) {
  const student = await prisma.user.findFirst({ where: { id: studentId, role: "STUDENT" }, include: { grade: true, reviewedBy: { select: { displayName: true, username: true } } } });
  if (!student || (student.studentStatus !== "PENDING" && student.studentStatus !== "REJECTED")) throw new ApiError("申请记录不存在", 404);
  const nationalId = student.nationalIdEncrypted ? decryptSensitiveValue(student.nationalIdEncrypted) : "";
  const phone = student.phoneEncrypted ? decryptSensitiveValue(student.phoneEncrypted) : "";
  return {
    username: student.username,
    displayName: student.displayName,
    nationalIdMasked: maskNationalId(nationalId),
    gender: student.gender,
    school: student.school ?? "",
    grade: { id: student.grade?.id ?? "", name: student.grade?.name ?? "未配置" },
    phoneMasked: maskPhone(phone),
    studentStatus: student.studentStatus,
    submittedAt: student.submittedAt?.toISOString() ?? null,
    rejectionReason: student.rejectionReason,
    reviewedAt: student.reviewedAt?.toISOString() ?? null,
    reviewerName: student.reviewedBy?.displayName || student.reviewedBy?.username || null,
  };
}

export async function getRegistrationEditProfile(studentId: string) {
  const student = await prisma.user.findFirst({ where: { id: studentId, role: "STUDENT", studentStatus: { in: ["PENDING", "REJECTED"] } } });
  if (!student || !student.nationalIdEncrypted || !student.phoneEncrypted || !student.gradeId || !student.gender) throw new ApiError("申请资料不完整", 409);
  return {
    username: student.username,
    displayName: student.displayName,
    nationalId: decryptSensitiveValue(student.nationalIdEncrypted),
    gender: student.gender,
    school: student.school ?? "",
    gradeId: student.gradeId,
    phone: decryptSensitiveValue(student.phoneEncrypted),
  };
}

export async function updateRegistrationProfile(studentId: string, rawInput: unknown) {
  const input = registrationProfileUpdateSchema.parse(rawInput);
  const nationalIdHash = hashSensitiveValue(input.nationalId);
  const phoneHash = hashSensitiveValue(input.phone);
  try {
    return await prisma.$transaction(async (tx) => {
      await requireEnabledGrade(tx, input.gradeId);
      await assertUniqueStudentIdentity(tx, { nationalIdHash, phoneHash, excludeId: studentId });
      const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", studentStatus: { in: ["PENDING", "REJECTED"] } } });
      if (!current || !current.studentStatus) throw new ApiError("申请状态不允许修改", 409);
      const updated = await tx.user.update({ where: { id: studentId }, data: {
        displayName: input.displayName,
        nationalIdEncrypted: encryptSensitiveValue(input.nationalId),
        nationalIdHash,
        nationalIdLast4: input.nationalId.slice(-4),
        gender: input.gender,
        school: input.school,
        gradeId: input.gradeId,
        phoneEncrypted: encryptSensitiveValue(input.phone),
        phoneHash,
        phoneLast4: input.phone.slice(-4),
        ...(current.studentStatus === "PENDING" ? { submittedAt: new Date() } : {}),
      } });
      const profileSnapshot = snapshot(updated);
      await tx.studentReviewRecord.create({ data: { studentId, actorUserId: studentId, action: "PROFILE_UPDATED", beforeStatus: current.studentStatus, afterStatus: current.studentStatus, profileSnapshot } });
      await tx.auditLog.create({ data: { actorUserId: studentId, action: "STUDENT_REGISTRATION_PROFILE_UPDATE", targetType: "User", targetId: studentId, metadata: profileSnapshot } });
      return { saved: true, sessionVersion: updated.sessionVersion };
    });
  } catch (error) {
    mapRegistrationConflict(error);
  }
}

export async function resubmitRegistration(studentId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
    if (!current || current.studentStatus !== "REJECTED") throw new ApiError("STALE_ACCOUNT_STATE", 409);
    assertReviewTransition("REJECTED", "PENDING");
    const result = await tx.user.updateMany({ where: { id: studentId, studentStatus: "REJECTED", updatedAt: current.updatedAt }, data: { studentStatus: "PENDING", rejectionReason: null, submittedAt: new Date(), reviewedAt: null, reviewedById: null, sessionVersion: { increment: 1 } } });
    if (result.count !== 1) throw new ApiError("STALE_ACCOUNT_STATE", 409);
    const updated = await tx.user.findUniqueOrThrow({ where: { id: studentId } });
    const profileSnapshot = snapshot(updated);
    await tx.studentReviewRecord.create({ data: { studentId, actorUserId: studentId, action: "RESUBMITTED", beforeStatus: "REJECTED", afterStatus: "PENDING", profileSnapshot } });
    await tx.auditLog.create({ data: { actorUserId: studentId, action: "STUDENT_REGISTRATION_RESUBMIT", targetType: "User", targetId: studentId, metadata: profileSnapshot } });
    return { submitted: true, sessionVersion: updated.sessionVersion };
  });
}

export async function approveRegistration(administratorId: string, studentId: string, rawInput: unknown, businessDate = getBusinessDate()) {
  const input = approveRegistrationSchema.parse(rawInput);
  const defaults = buildDefaultValidity(businessDate);
  const validFrom = input.validFrom ?? defaults.validFrom;
  const validUntil = input.validUntil ?? defaults.validUntil;
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
    if (!current || current.studentStatus !== "PENDING") throw new ApiError("STALE_ACCOUNT_STATE", 409);
    assertReviewTransition("PENDING", "ACTIVE");
    const reviewedAt = new Date();
    const result = await tx.user.updateMany({ where: { id: studentId, studentStatus: "PENDING", updatedAt: current.updatedAt }, data: { studentStatus: "ACTIVE", validFrom: dateValue(validFrom), validUntil: dateValue(validUntil), isLongTerm: input.isLongTerm ?? false, reviewedAt, reviewedById: administratorId, rejectionReason: null, sessionVersion: { increment: 1 } } });
    if (result.count !== 1) throw new ApiError("STALE_ACCOUNT_STATE", 409);
    const updated = await tx.user.findUniqueOrThrow({ where: { id: studentId } });
    const profileSnapshot = snapshot(updated);
    await tx.studentReviewRecord.create({ data: { studentId, actorUserId: administratorId, action: "APPROVED", beforeStatus: "PENDING", afterStatus: "ACTIVE", profileSnapshot } });
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_REGISTRATION_APPROVE", targetType: "User", targetId: studentId, metadata: { ...profileSnapshot, validFrom, validUntil, isLongTerm: updated.isLongTerm } } });
    return { approved: true };
  });
}

export async function rejectRegistration(administratorId: string, studentId: string, rawInput: unknown) {
  const input = rejectRegistrationSchema.parse(rawInput);
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
    if (!current || current.studentStatus !== "PENDING") throw new ApiError("STALE_ACCOUNT_STATE", 409);
    assertReviewTransition("PENDING", "REJECTED");
    const result = await tx.user.updateMany({ where: { id: studentId, studentStatus: "PENDING", updatedAt: current.updatedAt }, data: { studentStatus: "REJECTED", rejectionReason: input.reason, reviewedAt: new Date(), reviewedById: administratorId, sessionVersion: { increment: 1 } } });
    if (result.count !== 1) throw new ApiError("STALE_ACCOUNT_STATE", 409);
    const updated = await tx.user.findUniqueOrThrow({ where: { id: studentId } });
    const profileSnapshot = snapshot(updated);
    await tx.studentReviewRecord.create({ data: { studentId, actorUserId: administratorId, action: "REJECTED", beforeStatus: "PENDING", afterStatus: "REJECTED", rejectionReason: input.reason, profileSnapshot } });
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_REGISTRATION_REJECT", targetType: "User", targetId: studentId, metadata: { ...profileSnapshot, reason: input.reason } } });
    return { rejected: true };
  });
}

export async function listStudents(input: { status?: "PENDING" | "ACTIVE" | "REJECTED"; search?: string } = {}) {
  const search = input.search?.trim();
  const students = await prisma.user.findMany({ where: { role: "STUDENT", ...(input.status ? { studentStatus: input.status } : {}), ...(search ? { OR: [{ username: { contains: search } }, { displayName: { contains: search } }, { school: { contains: search } }, { phoneLast4: { contains: search } }] } : {}) }, include: { grade: true }, orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }] });
  return students.map((student) => ({ id: student.id, username: student.username, displayName: student.displayName, gender: student.gender, school: student.school, grade: student.grade, nationalIdMasked: student.nationalIdLast4 ? `${"*".repeat(14)}${student.nationalIdLast4}` : null, phoneMasked: student.phoneLast4 ? `***-***-${student.phoneLast4}` : null, registrationSource: student.registrationSource, studentStatus: student.studentStatus, enabled: student.enabled, validFrom: dateOnly(student.validFrom), validUntil: dateOnly(student.validUntil), isLongTerm: student.isLongTerm, createdAt: student.createdAt.toISOString() }));
}

export async function getStudentDetail(studentId: string) {
  const student = await prisma.user.findFirst({ where: { id: studentId, role: "STUDENT" }, include: { grade: true } });
  if (!student) throw new ApiError("学生账号不存在", 404);
  return {
    id: student.id,
    username: student.username,
    displayName: student.displayName,
    enabled: student.enabled,
    mustChangePassword: student.mustChangePassword,
    studentStatus: student.studentStatus,
    registrationSource: student.registrationSource,
    nationalId: student.nationalIdEncrypted ? decryptSensitiveValue(student.nationalIdEncrypted) : null,
    gender: student.gender,
    school: student.school,
    gradeId: student.gradeId,
    grade: student.grade,
    phone: student.phoneEncrypted ? decryptSensitiveValue(student.phoneEncrypted) : null,
    submittedAt: student.submittedAt,
    reviewedAt: student.reviewedAt,
    reviewedById: student.reviewedById,
    rejectionReason: student.rejectionReason,
    validFrom: dateOnly(student.validFrom),
    validUntil: dateOnly(student.validUntil),
    isLongTerm: student.isLongTerm,
    profileIncomplete: student.profileIncomplete,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export async function updateStudentAccount(administratorId: string, studentId: string, rawInput: unknown) {
  const input = adminStudentUpdateSchema.parse(rawInput);
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
    if (!current) throw new ApiError("学生账号不存在", 404);
    if (input.gradeId) await requireEnabledGrade(tx, input.gradeId);
    const nationalIdHash = input.nationalId ? hashSensitiveValue(input.nationalId) : current.nationalIdHash;
    const phoneHash = input.phone ? hashSensitiveValue(input.phone) : current.phoneHash;
    if (nationalIdHash && phoneHash) await assertUniqueStudentIdentity(tx, { nationalIdHash, phoneHash, excludeId: studentId });
    const updated = await tx.user.update({ where: { id: studentId }, data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.nationalId !== undefined ? { nationalIdEncrypted: encryptSensitiveValue(input.nationalId), nationalIdHash, nationalIdLast4: input.nationalId.slice(-4), gender: "gender" in input ? input.gender : undefined } : {}),
      ...(input.school !== undefined ? { school: input.school } : {}),
      ...(input.gradeId !== undefined ? { gradeId: input.gradeId } : {}),
      ...(input.phone !== undefined ? { phoneEncrypted: encryptSensitiveValue(input.phone), phoneHash, phoneLast4: input.phone.slice(-4) } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.validFrom !== undefined ? { validFrom: dateValue(input.validFrom) } : {}),
      ...(input.validUntil !== undefined ? { validUntil: dateValue(input.validUntil) } : {}),
      ...(input.isLongTerm !== undefined ? { isLongTerm: input.isLongTerm } : {}),
      sessionVersion: { increment: 1 },
    } });
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_ACCOUNT_UPDATE", targetType: "User", targetId: studentId, metadata: snapshot(updated) } });
    return { saved: true };
  });
}

export async function resetStudentPassword(administratorId: string, studentId: string) {
  const temporaryPassword = `${randomBytes(8).toString("base64url")}A1`;
  const result = await prisma.user.updateMany({ where: { id: studentId, role: "STUDENT" }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true, sessionVersion: { increment: 1 } } });
  if (result.count !== 1) throw new ApiError("学生账号不存在", 404);
  await prisma.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_PASSWORD_RESET", targetType: "User", targetId: studentId } });
  return { temporaryPassword };
}
