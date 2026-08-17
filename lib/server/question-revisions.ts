import "server-only";
import { Prisma, type Question } from "@/generated/prisma/client";

export const STALE_VERSION_MESSAGE = "数据已被其他教师更新，请刷新后重试";

type QuestionSnapshot = Pick<Question, "levelId" | "knowledgePointId" | "sourceBankCode" | "externalQuestionCode" | "stem" | "preserveOptionOrder" | "options" | "correctOptionIds" | "status">;

export function toQuestionSnapshot(question: QuestionSnapshot): Prisma.InputJsonObject {
  return {
    levelId: question.levelId,
    knowledgePointId: question.knowledgePointId,
    sourceBankCode: question.sourceBankCode,
    externalQuestionCode: question.externalQuestionCode,
    stem: question.stem,
    preserveOptionOrder: question.preserveOptionOrder,
    options: question.options as Prisma.InputJsonValue,
    correctOptionIds: question.correctOptionIds as Prisma.InputJsonValue,
    status: question.status,
  };
}

export function parseQuestionRevisionSnapshot(snapshot: unknown) {
  const parsed = snapshot as Record<string, unknown>;
  if (typeof parsed.levelId !== "string" || typeof parsed.knowledgePointId !== "string" || typeof parsed.stem !== "string" || !Array.isArray(parsed.options) || !Array.isArray(parsed.correctOptionIds) || !["ACTIVE", "DISABLED", "ARCHIVED"].includes(String(parsed.status))) {
    throw new Error("题目修订数据无效");
  }
  return {
    levelId: parsed.levelId,
    knowledgePointId: parsed.knowledgePointId,
    sourceBankCode: typeof parsed.sourceBankCode === "string" ? parsed.sourceBankCode : null,
    externalQuestionCode: typeof parsed.externalQuestionCode === "string" ? parsed.externalQuestionCode : null,
    stem: parsed.stem,
    preserveOptionOrder: parsed.preserveOptionOrder === true,
    options: parsed.options as Prisma.InputJsonValue,
    correctOptionIds: parsed.correctOptionIds as Prisma.InputJsonValue,
    status: parsed.status as "ACTIVE" | "DISABLED" | "ARCHIVED",
    explanation: typeof parsed.explanation === "string" || parsed.explanation === null ? parsed.explanation : undefined,
    explanationStatus: typeof parsed.explanationStatus === "string" ? parsed.explanationStatus : undefined,
    explanationVersion: typeof parsed.explanationVersion === "number" ? parsed.explanationVersion : undefined,
    explanationRejectReason: typeof parsed.explanationRejectReason === "string" || parsed.explanationRejectReason === null ? parsed.explanationRejectReason : undefined,
    explanationReviewedById: typeof parsed.explanationReviewedById === "string" || parsed.explanationReviewedById === null ? parsed.explanationReviewedById : undefined,
    explanationReviewedAt: typeof parsed.explanationReviewedAt === "string" ? parsed.explanationReviewedAt : undefined,
  };
}

export function toExplanationReviewSnapshot(question: Question) {
  return {
    ...toQuestionSnapshot(question),
    explanation: question.explanation,
    explanationStatus: question.explanationStatus,
    explanationVersion: question.explanationVersion,
    explanationRejectReason: question.explanationRejectReason ?? null,
    explanationReviewedById: question.explanationReviewedById ?? null,
    explanationReviewedAt: question.explanationReviewedAt ? question.explanationReviewedAt.toISOString() : null,
  };
}
