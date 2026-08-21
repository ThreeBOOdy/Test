import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { advanceLearningState } from "@/lib/domain/learning-state";

export type WriteStudentLevelQuestionStateInput = {
  userId: string;
  levelId: string;
  questionId: string;
  isCorrect: boolean;
  now?: Date;
  /**
   * Whether favorite/ignored marks from the existing StudentLevelQuestionState
   * should influence the FSRS rating. Practice modes use them
   * (correct + favorite -> HARD, correct + ignored -> EASY); mock exams must
   * always map to plain GOOD/AGAIN.
   */
  useManualMarks?: boolean;
};

/**
 * Shared write point for StudentLevelQuestionState.
 *
 * Every non-learning practice submission (level, random, wrong, favorite,
 * mock exam, ...) upserts the (userId, levelId, questionId) row through this
 * function. The FSRS transition is delegated to the pure domain module.
 */
export async function upsertStudentLevelQuestionState(
  tx: Prisma.TransactionClient,
  input: WriteStudentLevelQuestionStateInput,
): Promise<void> {
  const previous = await tx.studentLevelQuestionState.findUnique({
    where: {
      userId_levelId_questionId: {
        userId: input.userId,
        levelId: input.levelId,
        questionId: input.questionId,
      },
    },
  });

  const useManualMarks = input.useManualMarks ?? true;
  const next = advanceLearningState(previous, {
    isCorrect: input.isCorrect,
    favorite: useManualMarks ? (previous?.favorite ?? false) : false,
    ignored: useManualMarks ? (previous?.ignored ?? false) : false,
    now: input.now ?? new Date(),
  });

  const data = {
    userId: input.userId,
    levelId: input.levelId,
    questionId: input.questionId,
    state: next.state,
    dueAt: next.dueAt,
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    intervalDays: next.intervalDays,
    lastReviewedAt: next.lastReviewedAt,
    favorite: next.favorite,
    ignored: next.ignored,
    wrongCount: next.wrongCount,
    correctCount: next.correctCount,
    lastResult: next.lastResult,
  };

  await tx.studentLevelQuestionState.upsert({
    where: {
      userId_levelId_questionId: {
        userId: input.userId,
        levelId: input.levelId,
        questionId: input.questionId,
      },
    },
    create: data,
    update: data,
  });
}
