import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { writeAuditLogInTransaction } from "@/lib/server/audit";

type Transaction = Prisma.TransactionClient;

function positiveInteger(value: number | undefined, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value! > 0 ? Math.min(value!, maximum) : fallback;
}

export async function listTeacherStudents(input: { page?: number; pageSize?: number; search?: string; status?: "PENDING" | "ACTIVE" | "REJECTED" } = {}) {
  const page = positiveInteger(input.page, 1);
  const pageSize = positiveInteger(input.pageSize, 20, 100);
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
    const students = await tx.user.findMany({
      where,
      include: { grade: true, activeLevel: true },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: students.map((student) => ({
        id: student.id,
        username: student.username,
        realName: student.realName ?? student.displayName,
        school: student.school,
        grade: student.grade ? { name: student.grade.name } : null,
        studentStatus: student.studentStatus,
        enabled: student.enabled,
        activeLevel: student.activeLevel ? { id: student.activeLevel.id, code: student.activeLevel.code, name: student.activeLevel.name } : null,
      })),
      pagination: { page: currentPage, pageSize, total, totalPages },
    };
  });
}

export async function setStudentActiveLevel(teacherId: string, studentId: string, activeLevelId: string | null) {
  return prisma.$transaction(async (tx: Transaction) => {
    const current = await tx.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      include: { activeLevel: true },
    });
    if (!current) throw new ApiError("学生账号不存在", 404);

    let level: { id: string; code: string } | null = null;
    if (activeLevelId !== null) {
      level = await tx.level.findFirst({ where: { id: activeLevelId, enabled: true }, select: { id: true, code: true } });
      if (!level) throw new ApiError("字母类不存在或已停用", 404);
    }

    const updated = await tx.user.update({
      where: { id: studentId },
      data: { activeLevelId },
      select: { activeLevelId: true },
    });

    await writeAuditLogInTransaction(tx, {
      actorUserId: teacherId,
      action: "STUDENT_ACTIVE_LEVEL_UPDATE",
      targetType: "User",
      targetId: studentId,
      metadata: {
        previousActiveLevelId: current.activeLevelId,
        previousActiveLevelCode: current.activeLevel?.code ?? null,
        activeLevelId: updated.activeLevelId,
        activeLevelCode: level?.code ?? null,
      },
    });

    return { saved: true, activeLevelId: updated.activeLevelId };
  });
}
