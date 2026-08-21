import "server-only";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";

export type StudentActiveLevelAccess = {
  activeLevelId: string | null;
  activeLevel: {
    id: string;
    code: string;
    name: string;
    enabled: boolean;
  } | null;
};

export async function getStudentActiveLevelAccess(userId: string): Promise<StudentActiveLevelAccess> {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      activeLevelId: true,
      activeLevel: {
        select: { id: true, code: true, name: true, enabled: true },
      },
    },
  });
  if (!student) throw new ApiError("学生账号不存在", 404);
  return student;
}

export function requireAssignedActiveLevel(access: StudentActiveLevelAccess) {
  if (!access.activeLevelId || !access.activeLevel || !access.activeLevel.enabled) {
    throw new ApiError("未分配题库，请联系老师", 403);
  }
  return access.activeLevel;
}
