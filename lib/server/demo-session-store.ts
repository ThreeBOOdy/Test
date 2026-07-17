import "server-only";
import { randomUUID } from "node:crypto";
import { getDescendantIds } from "@/lib/domain/knowledge-tree";
import { isAnswerCorrect, selectPracticeQuestions } from "@/lib/domain/practice-engine";
import { knowledgePoints, knowledgeRules, levelRules, levels, questions } from "@/lib/data/demo";
import type { PracticeMode, Question } from "@/lib/domain/types";

export type PublicQuestion = Omit<Question, "correctOptionIds" | "status"> & { knowledgeName: string; levelCode: string };
export type DemoSession = {
  id: string;
  mode: PracticeMode;
  title: string;
  questions: Question[];
  answers: Map<string, { selectedOptionIds: string[]; isCorrect: boolean }>;
  startedAt: Date;
};

const globalStore = globalThis as typeof globalThis & { practiceSessions?: Map<string, DemoSession> };
const sessions = globalStore.practiceSessions ?? new Map<string, DemoSession>();
if (process.env.NODE_ENV !== "production") globalStore.practiceSessions = sessions;

export function createDemoSession(input: { mode: "level" | "knowledge"; levelCode: string; knowledgePointId?: string }) {
  const level = levels.find((item) => item.code === input.levelCode) ?? levels[0];
  const mode: PracticeMode = input.mode === "knowledge" ? "KNOWLEDGE_POINT" : "LEVEL_COMPREHENSIVE";
  const point = input.knowledgePointId ? knowledgePoints.find((item) => item.id === input.knowledgePointId) : undefined;
  const rule = mode === "KNOWLEDGE_POINT" && point ? knowledgeRules[`${point.id}:${level.id}`] ?? { singleCount: 2, multipleCount: 1 } : levelRules[level.id];
  const knowledgePointIds = point ? getDescendantIds(knowledgePoints, point.id) : undefined;
  const selection = selectPracticeQuestions(questions, { mode, levelId: level.id, knowledgePointIds, rule });
  const session: DemoSession = {
    id: randomUUID(),
    mode,
    title: point ? `${point.name} · ${level.code}级` : `${level.code}级综合练习`,
    questions: selection.questions,
    answers: new Map(),
    startedAt: new Date(),
  };
  sessions.set(session.id, session);
  return toPublicSession(session);
}

export function toPublicSession(session: DemoSession) {
  return {
    id: session.id,
    mode: session.mode,
    title: session.title,
    total: session.questions.length,
    questions: session.questions.map(toPublicQuestion),
  };
}

export function submitDemoAnswer(sessionId: string, questionId: string, selectedOptionIds: string[]) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("练习会话不存在或已失效");
  const question = session.questions.find((item) => item.id === questionId);
  if (!question) throw new Error("题目不属于当前练习");
  const existing = session.answers.get(questionId);
  if (existing) throw new Error("本题已经提交，不能重复修改");
  if (selectedOptionIds.length !== question.correctOptionCount) throw new Error(`本题要求选择 ${question.correctOptionCount} 项`);
  const isCorrect = isAnswerCorrect(selectedOptionIds, question.correctOptionIds);
  session.answers.set(questionId, { selectedOptionIds, isCorrect });
  return { isCorrect, correctOptionIds: question.correctOptionIds, answeredCount: session.answers.size, correctCount: [...session.answers.values()].filter((answer) => answer.isCorrect).length };
}

function toPublicQuestion(question: Question): PublicQuestion {
  const point = knowledgePoints.find((item) => item.id === question.knowledgePointId);
  const level = levels.find((item) => item.id === question.levelId);
  return {
    id: question.id,
    levelId: question.levelId,
    knowledgePointId: question.knowledgePointId,
    sourceBankCode: question.sourceBankCode,
    externalQuestionCode: question.externalQuestionCode,
    stem: question.stem,
    type: question.type,
    optionCount: question.optionCount,
    correctOptionCount: question.correctOptionCount,
    selectionSpec: question.selectionSpec,
    options: question.options,
    knowledgeName: point?.name ?? "未分类",
    levelCode: level?.code ?? "-",
  };
}

