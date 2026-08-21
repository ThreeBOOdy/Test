import type {
  ExamBlueprintAllocation,
  ExamBlueprintInput,
  ExamBlueprintItem,
  ExamBlueprintItemWeight,
  ExamRule,
  KnowledgePoint,
  PracticeRule,
} from "@/lib/domain/types";
import { getDescendantIds } from "@/lib/domain/knowledge-tree";

export const DEFAULT_EXAM_BLUEPRINT_NAME = "默认模拟测试";

type ExamRuleLike = {
  singleCount: number;
  multipleCount: number;
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
};

/**
 * Build the default blueprint row from a legacy ExamRule.
 *
 * The legacy rule only has per-level totals, so the blueprint keeps those
 * totals and the per-knowledge-point split happens in `allocateExamBlueprintItems`.
 */
export function buildDefaultExamBlueprintInput(rule: ExamRuleLike, levelId: string): ExamBlueprintInput {
  return {
    levelId,
    name: DEFAULT_EXAM_BLUEPRINT_NAME,
    durationMinutes: rule.durationMinutes,
    passingCount: rule.passingCount,
    enabled: rule.enabled,
    isDefault: true,
  };
}

/**
 * Split a legacy ExamRule total into per-knowledge-point blueprint items.
 *
 * Weights prefer existing KnowledgePracticeRule counts, then fall back to
 * active question inventory. When there is no meaningful weight at all, a
 * single fallback knowledge point carries the whole legacy total so the
 * migrated default blueprint remains usable.
 */
export function allocateExamBlueprintItems(
  rule: Pick<ExamRule, "singleCount" | "multipleCount">,
  weights: readonly ExamBlueprintItemWeight[] = [],
  fallbackKnowledgePointId?: string,
): ExamBlueprintAllocation[] {
  if (rule.singleCount === 0 && rule.multipleCount === 0) return [];

  const positiveWeights = weights.filter((weight) => weight.singleWeight > 0 || weight.multipleWeight > 0);
  if (positiveWeights.length === 0) {
    return fallbackKnowledgePointId
      ? [{ knowledgePointId: fallbackKnowledgePointId, singleCount: rule.singleCount, multipleCount: rule.multipleCount }]
      : [];
  }

  const totalSingleWeight = positiveWeights.reduce((sum, weight) => sum + Math.max(0, weight.singleWeight), 0);
  const totalMultipleWeight = positiveWeights.reduce((sum, weight) => sum + Math.max(0, weight.multipleWeight), 0);

  const allocations = positiveWeights.map((weight) => ({
    knowledgePointId: weight.knowledgePointId,
    singleCount: totalSingleWeight > 0 ? Math.floor((rule.singleCount * Math.max(0, weight.singleWeight)) / totalSingleWeight) : 0,
    multipleCount: totalMultipleWeight > 0 ? Math.floor((rule.multipleCount * Math.max(0, weight.multipleWeight)) / totalMultipleWeight) : 0,
  }));

  const singleSum = allocations.reduce((sum, item) => sum + item.singleCount, 0);
  const multipleSum = allocations.reduce((sum, item) => sum + item.multipleCount, 0);
  const remainingSingle = rule.singleCount - singleSum;
  const remainingMultiple = rule.multipleCount - multipleSum;

  if (remainingSingle > 0 || remainingMultiple > 0) {
    const topIndex = allocations
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftWeight = positiveWeights[left.index].singleWeight + positiveWeights[left.index].multipleWeight;
        const rightWeight = positiveWeights[right.index].singleWeight + positiveWeights[right.index].multipleWeight;
        return rightWeight - leftWeight || left.item.knowledgePointId.localeCompare(right.item.knowledgePointId);
      })[0]?.index ?? 0;
    allocations[topIndex] = {
      ...allocations[topIndex],
      singleCount: allocations[topIndex].singleCount + remainingSingle,
      multipleCount: allocations[topIndex].multipleCount + remainingMultiple,
    };
  }

  return allocations.filter((item) => item.singleCount > 0 || item.multipleCount > 0);
}

export function validateExamBlueprintItem(item: Pick<ExamBlueprintItem, "singleCount" | "multipleCount">) {
  if (!Number.isInteger(item.singleCount) || item.singleCount < 0) throw new Error("单选题数量必须是非负整数");
  if (!Number.isInteger(item.multipleCount) || item.multipleCount < 0) throw new Error("多选题数量必须是非负整数");
  if (item.singleCount + item.multipleCount <= 0) throw new Error("蓝图条目题量不能为 0");
  return item;
}

export function validateExamBlueprint(
  blueprint: Pick<ExamBlueprintInput, "name" | "durationMinutes" | "passingCount" | "enabled" | "isDefault"> & {
    items?: Array<Pick<ExamBlueprintItem, "singleCount" | "multipleCount">>;
  },
) {
  if (!blueprint.name?.trim()) throw new Error("蓝图名称不能为空");
  if (blueprint.durationMinutes != null && (!Number.isInteger(blueprint.durationMinutes) || blueprint.durationMinutes <= 0)) {
    throw new Error("考试时间必须大于 0 分钟或留空表示不限时");
  }
  if (!Number.isInteger(blueprint.passingCount) || blueprint.passingCount <= 0) throw new Error("合格题数必须大于 0");
  if (blueprint.items) {
    if (blueprint.items.length === 0) throw new Error("蓝图至少需要一个条目");
    const total = blueprint.items.reduce((sum, item) => sum + item.singleCount + item.multipleCount, 0);
    if (total <= 0) throw new Error("模拟考试题量不能为 0");
    if (blueprint.passingCount > total) throw new Error("合格题数不能超过试卷总题数");
    for (const item of blueprint.items) validateExamBlueprintItem(item);
  }
  return blueprint;
}

export type ExamBlueprintStockIssue = {
  knowledgePointId: string;
  knowledgePointCode: string;
  knowledgePointName: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  required: number;
  available: number;
};

/**
 * Reject duplicate and ancestor/descendant knowledge point selections in a
 * blueprint. The `points` array must contain the full knowledge point tree so
 * descendant relationships can be resolved.
 */
export function validateExamBlueprintKnowledgePointOverlap(
  items: readonly Pick<ExamBlueprintItem, "knowledgePointId">[],
  points: readonly Pick<KnowledgePoint, "id" | "code" | "name" | "parentId">[],
) {
  const ids = items.map((item) => item.knowledgePointId);
  if (new Set(ids).size !== ids.length) throw new Error("蓝图条目知识点不能重复");

  const pointById = new Map(points.map((point) => [point.id, point]));
  for (const id of ids) {
    if (!pointById.has(id)) throw new Error("知识点不存在");
  }

  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const leftId = ids[left];
      const rightId = ids[right];
      const leftDescendants = new Set(getDescendantIds(points, leftId));
      if (leftDescendants.has(rightId)) {
        throw new Error(`蓝图条目知识点存在父子重叠：${pointById.get(leftId)!.name} 与 ${pointById.get(rightId)!.name} 不能同时选择`);
      }
      const rightDescendants = new Set(getDescendantIds(points, rightId));
      if (rightDescendants.has(leftId)) {
        throw new Error(`蓝图条目知识点存在父子重叠：${pointById.get(rightId)!.name} 与 ${pointById.get(leftId)!.name} 不能同时选择`);
      }
    }
  }
  return items;
}

/**
 * Compare requested blueprint item counts with per-knowledge-point inventory.
 * Returns one issue per question type where the requested count exceeds stock.
 */
export function findExamBlueprintStockIssues(
  items: readonly Pick<ExamBlueprintItem, "knowledgePointId" | "singleCount" | "multipleCount">[],
  inventoryByPointId: ReadonlyMap<string, PracticeRule>,
  pointById: ReadonlyMap<string, Pick<KnowledgePoint, "id" | "code" | "name">>,
): ExamBlueprintStockIssue[] {
  const issues: ExamBlueprintStockIssue[] = [];
  for (const item of items) {
    const point = pointById.get(item.knowledgePointId);
    if (!point) continue;
    const inventory = inventoryByPointId.get(item.knowledgePointId) ?? { singleCount: 0, multipleCount: 0 };
    if (item.singleCount > inventory.singleCount) {
      issues.push({
        knowledgePointId: item.knowledgePointId,
        knowledgePointCode: point.code,
        knowledgePointName: point.name,
        questionType: "SINGLE_CHOICE",
        required: item.singleCount,
        available: inventory.singleCount,
      });
    }
    if (item.multipleCount > inventory.multipleCount) {
      issues.push({
        knowledgePointId: item.knowledgePointId,
        knowledgePointCode: point.code,
        knowledgePointName: point.name,
        questionType: "MULTIPLE_CHOICE",
        required: item.multipleCount,
        available: inventory.multipleCount,
      });
    }
  }
  return issues;
}

export function formatExamBlueprintStockIssue(issue: ExamBlueprintStockIssue) {
  const typeLabel = issue.questionType === "SINGLE_CHOICE" ? "单选" : "多选";
  return `知识点“${issue.knowledgePointName}”（${issue.knowledgePointCode}）${typeLabel}库存不足：需要 ${issue.required} 题，当前仅 ${issue.available} 题，缺少 ${issue.required - issue.available} 题`;
}
