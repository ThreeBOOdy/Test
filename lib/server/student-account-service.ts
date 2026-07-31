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
  radioPersonCreateSchema,
  radioPersonUpdateSchema,
} from "@/lib/domain/student-registration";
import { hashPassword } from "@/lib/server/password";
import { regeneratePendingStudentActivation } from "@/lib/server/student-activation-service";
import { revokeUserSessions } from "@/lib/server/session";
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

function snapshot(input: { username: string; displayName: string; realName: string | null; school: string | null; gradeId: string | null; gender: string | null; nationalIdLast4: string | null; phoneLast4: string | null; radioPersonId: string | null }) {
  return {
    username: input.username,
    realName: input.realName ?? input.displayName,
    school: input.school,
    gradeId: input.gradeId,
    gender: input.gender,
    nationalIdLast4: input.nationalIdLast4,
    phoneLast4: input.phoneLast4,
    radioPersonId: input.radioPersonId,
  };
}

async function requireEnabledGrade(tx: Transaction, gradeId: string) {
  const grade = await tx.grade.findFirst({ where: { id: gradeId, enabled: true } });
  if (!grade) throw new ApiError("请选择启用的年级", 400);
  return grade;
}

async function assertUniqueStudentIdentity(tx: Transaction, input: { nationalIdHash: string; phoneHash: string; excludeId?: string }) {
  const conflict = await tx.user.findFirst({
    where: {
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [{ nationalIdHash: input.nationalIdHash }, { phoneHash: input.phoneHash }],
    },
    select: { id: true },
  });
  if (conflict) throw new ApiError("REGISTRATION_CONFLICT", 409);
}

async function requireAvailableRadioPerson(tx: Transaction, radioPersonId: string) {
  const person = await tx.radioPerson.findFirst({ where: { id: radioPersonId, resourceStatus: "AVAILABLE", student: null } });
  if (person) {
    const usernameConflict = await tx.user.findUnique({ where: { username: person.username }, select: { id: true } });
    if (usernameConflict) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  }
  if (!person) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  return person;
}

export async function listAvailableRadioPeople() {
  const occupiedUsernames = (await prisma.user.findMany({ select: { username: true } })).map((user) => user.username);
  const people = await prisma.radioPerson.findMany({
    where: { resourceStatus: "AVAILABLE", student: null, username: { notIn: occupiedUsernames } },
    orderBy: { name: "asc" },
    select: { id: true, username: true, name: true, profile: true, resourceStatus: true, statusNote: true },
  });
  return { people };
}

function mapRegistrationConflict(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
    if (target.includes("radioPersonId") || target.includes("username")) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
    throw new ApiError("REGISTRATION_CONFLICT", 409);
  }
  throw error;
}

export async function listRadioPeopleForAdministration() {
  return prisma.radioPerson.findMany({
    include: { student: { select: { id: true, username: true, realName: true, displayName: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createRadioPerson(administratorId: string, rawInput: unknown) {
  const input = radioPersonCreateSchema.parse(rawInput);
  try {
    return await prisma.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { username: input.username }, select: { id: true } })) throw new ApiError("人物用户名已被账号占用", 409);
      const created = await tx.radioPerson.create({ data: { ...input, statusNote: input.statusNote ?? null } });
      await tx.auditLog.create({ data: { actorUserId: administratorId, action: "RADIO_PERSON_CREATE", targetType: "RadioPerson", targetId: created.id, metadata: { username: created.username, name: created.name } } });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError("人物标识或人物用户名已存在", 409);
    throw error;
  }
}

export async function updateRadioPerson(administratorId: string, radioPersonId: string, rawInput: unknown) {
  const input = radioPersonUpdateSchema.parse(rawInput);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.radioPerson.findUnique({ where: { id: radioPersonId }, include: { student: { select: { id: true } } } });
      if (!current) throw new ApiError("人物身份不存在", 404);
      if (current.student && (current.username !== input.username || current.name !== input.name || current.profile !== input.profile)) throw new ApiError("已绑定人物身份只能维护资源状态", 409);
      const owner = await tx.user.findFirst({ where: { username: input.username, ...(current.student ? { id: { not: current.student.id } } : {}) }, select: { id: true } });
      if (owner) throw new ApiError("人物用户名已被账号占用", 409);
      const updated = await tx.radioPerson.update({ where: { id: radioPersonId }, data: { username: input.username, name: input.name, profile: input.profile, resourceStatus: input.resourceStatus, statusNote: input.statusNote ?? null } });
      await tx.auditLog.create({ data: { actorUserId: administratorId, action: "RADIO_PERSON_UPDATE", targetType: "RadioPerson", targetId: updated.id, metadata: { username: updated.username, name: updated.name, resourceStatus: updated.resourceStatus } } });
      return updated;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError("人物用户名已存在", 409);
    throw error;
  }
}
export async function registerStudent(rawInput: unknown) {
  const input = publicRegistrationSchema.parse(rawInput);
  const nationalIdHash = hashSensitiveValue(input.nationalId);
  const phoneHash = hashSensitiveValue(input.phone);
  try {
    return await prisma.$transaction(async (tx) => {
      await requireEnabledGrade(tx, input.gradeId);
      await assertUniqueStudentIdentity(tx, { nationalIdHash, phoneHash });
      const person = await requireAvailableRadioPerson(tx, input.radioPersonId);
      const submittedAt = new Date();
      const student = await tx.user.create({ data: {
        username: person.username,
        displayName: input.displayName,
        realName: input.realName,
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
        radioPersonId: person.id,
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
    realName: student.realName ?? student.displayName,
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
    realName: student.realName ?? student.displayName,
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
      const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", studentStatus: { in: ["PENDING", "REJECTED"] } } });
      if (!current || !current.studentStatus) throw new ApiError("申请状态不允许修改", 409);
      await assertUniqueStudentIdentity(tx, { nationalIdHash, phoneHash, excludeId: studentId });
      const updated = await tx.user.update({ where: { id: studentId }, data: {
        displayName: input.displayName,
        realName: input.displayName,
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
  try {
    return await prisma.$transaction((tx) => approveRegistrationInTransaction(tx, administratorId, studentId, input, businessDate));
  } catch (error) {
    mapReviewConflict(error);
  }
}

function mapReviewConflict(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new ApiError("STALE_ACCOUNT_STATE", 409);
  throw error;
}

async function assertRegistrationApprovalConflicts(tx: Transaction, student: { id: string; username: string; nationalIdHash: string | null; phoneHash: string | null; radioPersonId: string | null }) {
  if (!student.radioPersonId) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  const person = await tx.radioPerson.findUnique({ where: { id: student.radioPersonId }, include: { student: { select: { id: true } } } });
  if (!person || person.resourceStatus !== "AVAILABLE" || person.student?.id !== student.id || person.username !== student.username) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  const usernameOwner = await tx.user.findUnique({ where: { username: student.username }, select: { id: true } });
  if (!usernameOwner || usernameOwner.id !== student.id || !student.nationalIdHash || !student.phoneHash) throw new ApiError("REGISTRATION_CONFLICT", 409);
  await assertUniqueStudentIdentity(tx, { nationalIdHash: student.nationalIdHash, phoneHash: student.phoneHash, excludeId: student.id });
}

async function approveRegistrationInTransaction(tx: Transaction, administratorId: string, studentId: string, input: ReturnType<typeof approveRegistrationSchema.parse>, businessDate: string) {
  const defaults = buildDefaultValidity(businessDate);
  const validFrom = input.validFrom ?? defaults.validFrom;
  const validUntil = input.validUntil ?? defaults.validUntil;
  const current = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
  if (!current || current.studentStatus !== "PENDING") throw new ApiError("STALE_ACCOUNT_STATE", 409);
  await assertRegistrationApprovalConflicts(tx, current);
  assertReviewTransition("PENDING", "ACTIVE");
  const reviewedAt = new Date();
  const result = await tx.user.updateMany({ where: { id: studentId, studentStatus: "PENDING", updatedAt: current.updatedAt }, data: { studentStatus: "ACTIVE", validFrom: dateValue(validFrom), validUntil: dateValue(validUntil), isLongTerm: input.isLongTerm ?? false, reviewedAt, reviewedById: administratorId, rejectionReason: null, sessionVersion: { increment: 1 } } });
  if (result.count !== 1) throw new ApiError("STALE_ACCOUNT_STATE", 409);
  const updated = await tx.user.findUniqueOrThrow({ where: { id: studentId } });
  const profileSnapshot = snapshot(updated);
  await tx.studentReviewRecord.create({ data: { studentId, actorUserId: administratorId, action: "APPROVED", beforeStatus: "PENDING", afterStatus: "ACTIVE", profileSnapshot } });
  await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_REGISTRATION_APPROVE", targetType: "User", targetId: studentId, metadata: { ...profileSnapshot, validFrom, validUntil, isLongTerm: updated.isLongTerm } } });
  return { approved: true };
}

export async function approveRegistrations(administratorId: string, studentIds: string[], businessDate = getBusinessDate()) {
  if (new Set(studentIds).size !== studentIds.length) throw new ApiError("批量审核目标不能重复", 400);
  try {
    return await prisma.$transaction(async (tx) => {
      for (const studentId of studentIds) await approveRegistrationInTransaction(tx, administratorId, studentId, {}, businessDate);
      return { approved: studentIds.length };
    });
  } catch (error) {
    mapReviewConflict(error);
  }
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
  return students.map((student) => ({ id: student.id, username: student.username, realName: student.realName ?? student.displayName, displayName: student.displayName, gender: student.gender, school: student.school, grade: student.grade, nationalIdMasked: student.nationalIdLast4 ? `${"*".repeat(14)}${student.nationalIdLast4}` : null, phoneMasked: student.phoneLast4 ? `***-***-${student.phoneLast4}` : null, registrationSource: student.registrationSource, studentStatus: student.studentStatus, enabled: student.enabled, validFrom: dateOnly(student.validFrom), validUntil: dateOnly(student.validUntil), isLongTerm: student.isLongTerm, createdAt: student.createdAt.toISOString() }));
}

export async function listRegistrationReviews(input: { page?: number; pageSize?: number; status?: "PENDING" | "ACTIVE" | "REJECTED"; search?: string } = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const search = input.search?.trim();
  const where = {
    role: "STUDENT" as const,
    ...(input.status ? { studentStatus: input.status } : {}),
    ...(search ? { OR: [{ username: { contains: search } }, { displayName: { contains: search } }, { realName: { contains: search } }, { school: { contains: search } }, { phoneLast4: { contains: search } }] } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const total = await tx.user.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const students = await tx.user.findMany({ where, include: { grade: true }, orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }], skip: (currentPage - 1) * pageSize, take: pageSize });
    return {
      items: students.map((student) => ({ id: student.id, username: student.username, realName: student.realName ?? student.displayName, school: student.school, grade: student.grade ? { name: student.grade.name } : null, nationalIdMasked: student.nationalIdLast4 ? `**************${student.nationalIdLast4}` : null, phoneMasked: student.phoneLast4 ? `***-***-${student.phoneLast4}` : null, studentStatus: student.studentStatus, submittedAt: student.submittedAt?.toISOString() ?? null })),
      pagination: { page: currentPage, pageSize, total, totalPages },
    };
  });
}

export async function getStudentDetail(studentId: string) {
  const student = await prisma.user.findFirst({ where: { id: studentId, role: "STUDENT" }, include: { grade: true } });
  if (!student) throw new ApiError("学生账号不存在", 404);
  return {
    id: student.id,
    username: student.username,
    realName: student.realName ?? student.displayName,
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
      ...(input.displayName !== undefined ? { displayName: input.displayName, realName: input.displayName } : {}),
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
    await revokeUserSessions(studentId, tx);
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_ACCOUNT_UPDATE", targetType: "User", targetId: studentId, metadata: snapshot(updated) } });
    return { saved: true };
  });
}

export async function resetStudentPassword(administratorId: string, studentId: string) {
  const student = await prisma.user.findFirst({ where: { id: studentId, role: "STUDENT" }, select: { activationRequired: true } });
  if (!student) throw new ApiError("学生账号不存在", 404);
  if (student.activationRequired) {
    const credential = await regeneratePendingStudentActivation(administratorId, studentId);
    return { activationRequired: true, initialPassword: credential.initialPassword, activationCode: credential.activationCode, expiresAt: credential.expiresAt.toISOString() };
  }
  const temporaryPassword = `${randomBytes(8).toString("base64url")}A1`;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: studentId }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true, sessionVersion: { increment: 1 } } });
    await revokeUserSessions(studentId, tx);
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_PASSWORD_RESET", targetType: "User", targetId: studentId } });
  });
  return { activationRequired: false, temporaryPassword };
}
