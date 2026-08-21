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
  studentSelfWrongClearEnabled: boolean;
};

export async function listGradeGamificationSettings(): Promise<GradeGamificationSetting[]> {
  const grades = await prisma.grade.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return grades.map(toGradeSetting);
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

  return toGradeSetting({ ...grade, gamificationEnabled: enabled });
}

export async function setGradeStudentSelfWrongClearEnabled(
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
    data: { studentSelfWrongClearEnabled: enabled },
  });
  await writeAuditLog({
    actorUserId,
    action: "GRADE_WRONG_CLEAR_SETTING_UPDATE",
    targetType: "Grade",
    targetId: gradeId,
    metadata: { enabled },
  });

  return toGradeSetting({ ...grade, studentSelfWrongClearEnabled: enabled });
}

function toGradeSetting(grade: {
  id: string;
  code: string;
  name: string;
  gamificationEnabled: boolean;
  studentSelfWrongClearEnabled: boolean;
  _count: { students: number };
}): GradeGamificationSetting {
  return {
    id: grade.id,
    code: grade.code,
    name: grade.name,
    studentCount: grade._count.students,
    gamificationEnabled: grade.gamificationEnabled,
    studentSelfWrongClearEnabled: grade.studentSelfWrongClearEnabled,
  };
}
