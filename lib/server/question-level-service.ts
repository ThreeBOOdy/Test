import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { writeAuditLogInTransaction } from "@/lib/server/audit";

type Transaction = Prisma.TransactionClient;

async function validateQuestions(tx: Transaction, questionIds: string[]) {
  const questions = await tx.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, status: true },
  });
  const foundIds = new Set(questions.map((question) => question.id));
  const missing = questionIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) throw new ApiError(`部分题目不存在（${missing.length} 道）`, 404);
  const archived = questions.find((question) => question.status === "ARCHIVED");
  if (archived) throw new ApiError("归档题目不能修改字母类归类", 409);
  return questions;
}

export async function assignQuestionLevels(actorUserId: string, questionIds: string[], levelIds: string[]) {
  const uniqueQuestionIds = [...new Set(questionIds)];
  const uniqueLevelIds = [...new Set(levelIds)];
  return prisma.$transaction(async (tx) => {
    await validateQuestions(tx, uniqueQuestionIds);
    const levels = await tx.level.findMany({
      where: { id: { in: uniqueLevelIds }, enabled: true },
      select: { id: true },
    });
    if (levels.length !== uniqueLevelIds.length) throw new ApiError("字母类不存在或已停用", 404);

    const existing = await tx.questionLevel.findMany({
      where: { questionId: { in: uniqueQuestionIds }, levelId: { in: uniqueLevelIds } },
      select: { questionId: true, levelId: true },
    });
    const existingKeys = new Set(existing.map((item) => `${item.questionId}:${item.levelId}`));
    const pendingPairs: Array<{ questionId: string; levelId: string }> = [];
    for (const questionId of uniqueQuestionIds) {
      for (const levelId of uniqueLevelIds) {
        if (!existingKeys.has(`${questionId}:${levelId}`)) pendingPairs.push({ questionId, levelId });
      }
    }
    const created = pendingPairs.length > 0
      ? await tx.questionLevel.createMany({ data: pendingPairs, skipDuplicates: true })
      : { count: 0 };
    const assigned = created.count;
    const skippedDuplicates = uniqueQuestionIds.length * uniqueLevelIds.length - assigned;

    for (const questionId of uniqueQuestionIds) {
      const questionAssigned = pendingPairs.filter((pair) => pair.questionId === questionId).length;
      const questionSkipped = uniqueLevelIds.length - questionAssigned;
      await writeAuditLogInTransaction(tx, {
        actorUserId,
        action: "QUESTION_LEVEL_ASSIGN",
        targetType: "Question",
        targetId: questionId,
        metadata: { levelIds: uniqueLevelIds, assigned: questionAssigned, skippedDuplicates: questionSkipped },
      });
    }
    return { assigned, skippedDuplicates };
  });
}

export async function removeQuestionLevels(actorUserId: string, questionIds: string[], levelIds: string[]) {
  const uniqueQuestionIds = [...new Set(questionIds)];
  const uniqueLevelIds = [...new Set(levelIds)];
  return prisma.$transaction(async (tx) => {
    await validateQuestions(tx, uniqueQuestionIds);
    const levels = await tx.level.findMany({
      where: { id: { in: uniqueLevelIds } },
      select: { id: true },
    });
    if (levels.length !== uniqueLevelIds.length) throw new ApiError("字母类不存在", 404);

    const existing = await tx.questionLevel.findMany({
      where: { questionId: { in: uniqueQuestionIds }, levelId: { in: uniqueLevelIds } },
      select: { questionId: true, levelId: true },
    });
    const removedByQuestion = new Map<string, number>();
    for (const item of existing) {
      removedByQuestion.set(item.questionId, (removedByQuestion.get(item.questionId) ?? 0) + 1);
    }
    const removed = existing.length > 0
      ? (await tx.questionLevel.deleteMany({
          where: { questionId: { in: uniqueQuestionIds }, levelId: { in: uniqueLevelIds } },
        })).count
      : 0;

    for (const questionId of uniqueQuestionIds) {
      await writeAuditLogInTransaction(tx, {
        actorUserId,
        action: "QUESTION_LEVEL_REMOVE",
        targetType: "Question",
        targetId: questionId,
        metadata: { levelIds: uniqueLevelIds, removed: removedByQuestion.get(questionId) ?? 0 },
      });
    }
    return { removed };
  });
}
