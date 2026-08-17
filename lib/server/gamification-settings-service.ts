import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { writeAuditLog } from "@/lib/server/audit";

export type GradeGamificationSetting = {
  id: string;
  code: string;
  name: string;
  studentCount: number;
  gamificationEnabled: boolean;
};

export async function listGradeGamificationSettings(): Promise<GradeGamificationSetting[]> {
  const grades = await prisma.grade.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return grades.map((grade) => ({
    id: grade.id,
    code: grade.code,
    name: grade.name,
    studentCount: grade._count.students,
    gamificationEnabled: grade.gamificationEnabled,
  }));
}

export async function setGradeGamificationEnabled(
  actorUserId: string,
  gradeId: string,
  enabled: boolean,
): Promise<GradeGamificationSetting> {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: { _count: { select: { students: true } } },
  });
  if (!grade) throw new ApiError("年级不存在", 404);

  await prisma.grade.update({
    where: { id: gradeId },
    data: { gamificationEnabled: enabled },
  });
  await writeAuditLog({
    actorUserId,
    action: "GRADE_GAMIFICATION_UPDATE",
    targetType: "Grade",
    targetId: gradeId,
    metadata: { enabled },
  });

  return {
    id: grade.id,
    code: grade.code,
    name: grade.name,
    studentCount: grade._count.students,
    gamificationEnabled: enabled,
  };
}
