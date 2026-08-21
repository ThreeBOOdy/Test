import "server-only";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { getStudentActiveLevelAccess, requireAssignedActiveLevel } from "@/lib/server/student-level-access";

export type ClearWrongQuestionsResult = {
  cleared: number;
  levelId: string;
  levelCode: string;
};

export async function canStudentSelfClearWrongQuestions(userId: string): Promise<boolean> {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { grade: { select: { studentSelfWrongClearEnabled: true } } },
  });
  return student?.grade?.studentSelfWrongClearEnabled ?? false;
}

/**
 * Teacher-triggered one-click clear: resets every wrongCount>0
 * StudentLevelQuestionState under the student's active level back to NEW.
 */
export async function clearStudentWrongQuestions(
  actorUserId: string,
  studentId: string,
): Promise<ClearWrongQuestionsResult> {
  return clearWrongQuestions(actorUserId, studentId);
}

/**
 * Student self-service one-click clear. Only allowed when the student's grade
 * has studentSelfWrongClearEnabled turned on by a teacher.
 */
export async function clearOwnWrongQuestions(userId: string): Promise<ClearWrongQuestionsResult> {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { grade: { select: { studentSelfWrongClearEnabled: true } } },
  });
  if (!student) throw new ApiError("学生账号不存在", 404);
  if (!student.grade?.studentSelfWrongClearEnabled) {
    throw new ApiError("当前未开放学生自助清除错题，请联系老师", 403);
  }
  return clearWrongQuestions(userId, userId);
}

async function clearWrongQuestions(
  actorUserId: string,
  studentId: string,
): Promise<ClearWrongQuestionsResult> {
  const access = await getStudentActiveLevelAccess(studentId);
  const activeLevel = requireAssignedActiveLevel(access);

  return prisma.$transaction(async (tx) => {
    const result = await tx.studentLevelQuestionState.updateMany({
      where: {
        userId: studentId,
        levelId: activeLevel.id,
        wrongCount: { gt: 0 },
      },
      data: {
        state: "NEW",
        dueAt: null,
        stability: 0,
        difficulty: 5,
        reps: 0,
        lapses: 0,
        intervalDays: 0,
        lastReviewedAt: null,
        wrongCount: 0,
        correctCount: 0,
        lastResult: null,
      },
    });

    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "WRONG_QUESTION_CLEAR",
      targetType: "User",
      targetId: studentId,
      metadata: {
        levelId: activeLevel.id,
        levelCode: activeLevel.code,
        cleared: result.count,
      },
    });

    return {
      cleared: result.count,
      levelId: activeLevel.id,
      levelCode: activeLevel.code,
    };
  });
}
