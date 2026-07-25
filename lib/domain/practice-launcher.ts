import type { PracticeMode } from "@/lib/domain/types";

export type PracticeLaunchInput = {
  mode: PracticeMode;
  levelCode?: string;
  knowledgePointId?: string;
};

export type PracticeLaunchParams = {
  mode?: string;
  level?: string;
  knowledge?: string;
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
  return `/student/practice/start?${params.toString()}`;
}

export function normalizePracticeLaunch(params: PracticeLaunchParams): PracticeLaunchInput {
  const mode = PARAM_TO_MODE[params.mode ?? "level"] ?? "LEVEL_COMPREHENSIVE";
  if (mode === "WRONG_QUESTION") return { mode };
  if (mode === "KNOWLEDGE_POINT") {
    return { mode, levelCode: params.level ?? "A", knowledgePointId: params.knowledge ?? "" };
  }
  return { mode, levelCode: params.level ?? "A" };
}
