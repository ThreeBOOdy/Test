import type { PracticeRule, QuestionStatus, QuestionType } from "@/lib/domain/types";

type KnowledgeRulePoint = {
  id: string;
  parentId: string | null;
  depth: number;
  enabled: boolean;
};

type InventoryQuestion = {
  levelId: string;
  knowledgePointId: string;
  type: QuestionType;
  status: QuestionStatus;
};

export function canConfigureKnowledgeRule(points: readonly KnowledgeRulePoint[], knowledgePointId: string) {
  const point = points.find((item) => item.id === knowledgePointId);
  if (!point || !point.enabled) return false;
  return !points.some((item) => item.parentId === point.id);
}

export function getKnowledgeRuleInventory(
  questions: readonly InventoryQuestion[],
  levelId: string,
  knowledgePointId: string,
): PracticeRule {
  let singleCount = 0;
  let multipleCount = 0;
  for (const question of questions) {
    if (question.status !== "ACTIVE" || question.levelId !== levelId || question.knowledgePointId !== knowledgePointId) continue;
    if (question.type === "SINGLE_CHOICE") singleCount += 1;
    else multipleCount += 1;
  }
  return { singleCount, multipleCount };
}

export function isPracticeRuleWithinInventory(rule: PracticeRule, inventory: PracticeRule) {
  return rule.singleCount >= 0
    && rule.multipleCount >= 0
    && rule.singleCount + rule.multipleCount > 0
    && rule.singleCount <= inventory.singleCount
    && rule.multipleCount <= inventory.multipleCount;
}
