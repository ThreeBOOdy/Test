import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { validatePasswordPolicy } from "@/lib/domain/security";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { revokeUserSessions } from "@/lib/server/session";

const ACTIVATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

type Transaction = Prisma.TransactionClient;
type ActivationCredential = { initialPassword: string; activationCode: string; expiresAt: Date };

const activationSchema = z.object({
  initialPassword: z.string().min(1).max(128),
  activationCode: z.string().min(1).max(128),
  newPassword: z.string().max(128),
  radioPersonId: z.string().trim().min(1).max(191),
}).strict();

function randomSecret(bytes = 18) {
  return randomBytes(bytes).toString("base64url");
}

export function createActivationCredential(now = new Date()): ActivationCredential {
  return {
    initialPassword: `${randomSecret()}A1`,
    activationCode: randomSecret(),
    expiresAt: new Date(now.getTime() + ACTIVATION_LIFETIME_MS),
  };
}

export async function issueStudentActivation(tx: Transaction, userId: string, credential = createActivationCredential()) {
  const existing = await tx.studentActivation.findUnique({ where: { userId }, select: { id: true, version: true } });
  if (existing) {
    const rotated = await tx.studentActivation.updateMany({
      where: { id: existing.id, version: existing.version },
      data: { version: { increment: 1 }, activationCodeHash: hashPassword(credential.activationCode), expiresAt: credential.expiresAt, usedAt: null },
    });
    if (rotated.count !== 1) throw new ApiError("激活凭据已被其他请求更新，请重新生成", 409);
  } else {
    await tx.studentActivation.create({ data: { userId, activationCodeHash: hashPassword(credential.activationCode), expiresAt: credential.expiresAt } });
  }
  return credential;
}

async function requireAvailableRadioPerson(tx: Transaction, radioPersonId: string, studentId: string) {
  const person = await tx.radioPerson.findFirst({ where: { id: radioPersonId, resourceStatus: "AVAILABLE", student: null } });
  if (!person) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  const usernameConflict = await tx.user.findFirst({ where: { username: person.username, id: { not: studentId } }, select: { id: true } });
  if (usernameConflict) throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  return person;
}

function mapActivationConflict(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError("RADIO_PERSON_UNAVAILABLE", 409);
  throw error;
}

export async function activateImportedStudent(studentId: string, rawInput: unknown) {
  const input = activationSchema.parse(rawInput);
  const policyMessage = validatePasswordPolicy(input.newPassword, "STUDENT");
  if (policyMessage) throw new ApiError(policyMessage, 400);
  if (input.initialPassword === input.newPassword) throw new ApiError("新密码不能与初始密码相同", 400);

  try {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.user.findFirst({
        where: { id: studentId, role: "STUDENT", activationRequired: true },
        include: { studentActivation: true },
      });
      if (!student || !student.studentActivation) throw new ApiError("激活凭据无效或已被使用", 409);
      const activation = student.studentActivation;
      if (activation.expiresAt <= new Date()) throw new ApiError("激活码已过期，请联系管理员重新生成凭据", 410);
      if (activation.usedAt || !verifyPassword(input.initialPassword, student.passwordHash) || !verifyPassword(input.activationCode, activation.activationCodeHash)) {
        throw new ApiError("初始密码或激活码不正确", 400);
      }
      const person = await requireAvailableRadioPerson(tx, input.radioPersonId, student.id);
      const consumed = await tx.studentActivation.updateMany({
        where: { id: activation.id, version: activation.version, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new ApiError("激活凭据无效或已被使用", 409);
      const updated = await tx.user.update({
        where: { id: student.id },
        data: { username: person.username, radioPersonId: person.id, passwordHash: hashPassword(input.newPassword), mustChangePassword: false, activationRequired: false, sessionVersion: { increment: 1 } },
      });
      await revokeUserSessions(student.id, tx);
      await tx.auditLog.create({ data: { actorUserId: student.id, action: "STUDENT_ACTIVATION_COMPLETE", targetType: "User", targetId: student.id, metadata: { radioPersonId: person.id, activationVersion: activation.version } } });
      return updated;
    });
  } catch (error) {
    mapActivationConflict(error);
  }
}

export async function purgeExpiredStudentActivations(retentionDays = 7, now = new Date()) {
  if (!Number.isInteger(retentionDays) || retentionDays < 0) throw new ApiError("保留天数必须是非负整数", 400);
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.studentActivation.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return { deleted: result.count };
}
export async function regeneratePendingStudentActivation(administratorId: string, studentId: string) {
  const credential = createActivationCredential();
  await prisma.$transaction(async (tx) => {
    const student = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", activationRequired: true }, select: { id: true } });
    if (!student) throw new ApiError("只有待激活学生可以重新生成凭据", 409);
    await tx.user.update({ where: { id: student.id }, data: { passwordHash: hashPassword(credential.initialPassword), mustChangePassword: false, sessionVersion: { increment: 1 } } });
    await issueStudentActivation(tx, student.id, credential);
    await revokeUserSessions(student.id, tx);
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_ACTIVATION_REGENERATE", targetType: "User", targetId: student.id, metadata: { expiresAt: credential.expiresAt.toISOString() } } });
  });
  return credential;
}
