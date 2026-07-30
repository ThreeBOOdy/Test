import "server-only";
import { Prisma, type Question } from "@/generated/prisma/client";

export const STALE_VERSION_MESSAGE = "数据已被其他教师更新，请刷新后重试";

type QuestionSnapshot = Pick<Question, "levelId" | "knowledgePointId" | "sourceBankCode" | "externalQuestionCode" | "stem" | "options" | "correctOptionIds" | "status">;

export function toQuestionSnapshot(question: QuestionSnapshot): Prisma.InputJsonValue {
  return {
    levelId: question.levelId,
    knowledgePointId: question.knowledgePointId,
    sourceBankCode: question.sourceBankCode,
    externalQuestionCode: question.externalQuestionCode,
    stem: question.stem,
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
    options: parsed.options as Prisma.InputJsonValue,
    correctOptionIds: parsed.correctOptionIds as Prisma.InputJsonValue,
    status: parsed.status as "ACTIVE" | "DISABLED" | "ARCHIVED",
  };
}
