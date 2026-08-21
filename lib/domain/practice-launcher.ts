import type { PracticeMode } from "@/lib/domain/types";

export type PracticeLaunchInput = {
  mode: PracticeMode;
  levelCode?: string;
  knowledgePointId?: string;
  questionId?: string;
  /** 模拟测试蓝图 ID；仅 MOCK_EXAM 模式使用。 */
  blueprintId?: string;
};

export type PracticeLaunchParams = {
  mode?: string;
  level?: string;
  knowledge?: string;
  question?: string;
  blueprint?: string;
};

const MODE_TO_PARAM: Record<PracticeMode, string> = {
  LEVEL_COMPREHENSIVE: "level",
  KNOWLEDGE_POINT: "knowledge",
  WRONG_QUESTION: "wrong",
  QUESTION_ORDER: "order",
  RANDOM_ALL: "random",
  MOCK_EXAM: "exam",
};

const PARAM_TO_MODE: Record<string, PracticeMode> = Object.fromEntries(
  Object.entries(MODE_TO_PARAM).map(([mode, param]) => [param, mode]),
) as Record<string, PracticeMode>;

export function buildPracticeLaunchHref(input: PracticeLaunchInput) {
  const params = new URLSearchParams({ mode: MODE_TO_PARAM[input.mode] });
  if (input.levelCode) params.set("level", input.levelCode);
  if (input.knowledgePointId) params.set("knowledge", input.knowledgePointId);
  if (input.questionId) params.set("question", input.questionId);
  if (input.blueprintId) params.set("blueprint", input.blueprintId);
  return `/student/practice/start?${params.toString()}`;
}

export function normalizePracticeLaunch(params: PracticeLaunchParams): PracticeLaunchInput {
  const mode = PARAM_TO_MODE[params.mode ?? "level"] ?? "LEVEL_COMPREHENSIVE";
  if (mode === "WRONG_QUESTION") return { mode, questionId: params.question || undefined };
  if (mode === "KNOWLEDGE_POINT") {
    return { mode, levelCode: params.level, knowledgePointId: params.knowledge ?? "" };
  }
  if (mode === "MOCK_EXAM") {
    return { mode, levelCode: params.level, blueprintId: params.blueprint || undefined };
  }
  return { mode, levelCode: params.level };
}
