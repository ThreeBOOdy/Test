import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { hashPassword } from "@/lib/server/password";
import { revokeUserSessions } from "@/lib/server/session";

const teacherAccountSchema = z.object({
  username: z.string().trim().min(3, "用户名至少需要 3 个字符").max(50, "用户名不能超过 50 个字符").regex(/^[A-Za-z0-9_.-]+$/, "用户名只能包含字母、数字、点、下划线和连字符"),
  displayName: z.string().trim().min(1, "请输入教师真实姓名").max(100, "教师真实姓名不能超过 100 个字符"),
});

function generateTemporaryPassword() { return randomBytes(18).toString("base64url"); }

export async function listTeachers() {
  return prisma.user.findMany({
    where: { role: "TEACHER" },
    select: { id: true, username: true, displayName: true, enabled: true, mustChangePassword: true, createdAt: true, updatedAt: true },
    orderBy: [{ enabled: "desc" }, { username: "asc" }],
  });
}

export async function createTeacherAccount(administratorId: string, rawInput: unknown) {
  const input = teacherAccountSchema.parse(rawInput);
  const temporaryPassword = generateTemporaryPassword();
  const teacher = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { username: input.username }, select: { id: true } });
    if (existing) throw new ApiError("用户名已存在", 409);
    const created = await tx.user.create({
      data: { username: input.username, displayName: input.displayName, passwordHash: hashPassword(temporaryPassword), role: "TEACHER", mustChangePassword: true },
      select: { id: true, username: true, displayName: true, enabled: true },
    });
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "TEACHER_ACCOUNT_CREATE", targetType: "User", targetId: created.id, metadata: { username: created.username, displayName: created.displayName } } });
    return created;
  });
  return { teacher, temporaryPassword };
}

export async function deactivateTeacherAccount(administratorId: string, teacherId: string) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({ where: { id: teacherId, role: "TEACHER", enabled: true }, data: { enabled: false, sessionVersion: { increment: 1 } } });
    if (result.count !== 1) {
      const teacher = await tx.user.findFirst({ where: { id: teacherId, role: "TEACHER" }, select: { id: true } });
      if (!teacher) throw new ApiError("教师账号不存在", 404);
      throw new ApiError("教师账号已停用", 409);
    }
    await revokeUserSessions(teacherId, tx);
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "TEACHER_ACCOUNT_DISABLE", targetType: "User", targetId: teacherId, metadata: { enabled: false } } });
    return { disabled: true };
  });
}

export async function resetTeacherPassword(administratorId: string, teacherId: string) {
  const temporaryPassword = generateTemporaryPassword();
  await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({ where: { id: teacherId, role: "TEACHER" }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true, sessionVersion: { increment: 1 } } });
    if (result.count !== 1) throw new ApiError("教师账号不存在", 404);
    await revokeUserSessions(teacherId, tx);
    await tx.auditLog.create({ data: { actorUserId: administratorId, action: "TEACHER_PASSWORD_RESET", targetType: "User", targetId: teacherId } });
  });
  return { temporaryPassword };
}
