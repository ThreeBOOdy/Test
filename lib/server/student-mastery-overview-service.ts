import "server-only";

import { prisma } from "@/lib/db";
import {
  summarizeStudentLevelQuestionStates,
  type StudentMasteryOverview,
} from "@/lib/domain/learning-state";
import {
  getStudentActiveLevelAccess,
  requireAssignedActiveLevel,
} from "@/lib/server/student-level-access";

export type { StudentMasteryOverview };

export async function getStudentMasteryOverview(userId: string): Promise<StudentMasteryOverview> {
  const access = await getStudentActiveLevelAccess(userId);
  const activeLevel = requireAssignedActiveLevel(access);
  const now = new Date();

  const [total, states] = await Promise.all([
    prisma.question.count({
      where: { status: "ACTIVE", levels: { some: { levelId: activeLevel.id } } },
    }),
    prisma.studentLevelQuestionState.findMany({
      where: { userId, levelId: activeLevel.id, question: { status: "ACTIVE" } },
      select: { reps: true, state: true, dueAt: true, intervalDays: true },
    }),
  ]);

  return {
    levelId: activeLevel.id,
    levelCode: activeLevel.code,
    levelName: activeLevel.name,
    ...summarizeStudentLevelQuestionStates({ total, states, now }),
  };
}
