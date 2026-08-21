import "server-only";
import { prisma } from "@/lib/db";
import { allocateExamBlueprintItems, buildDefaultExamBlueprintInput, DEFAULT_EXAM_BLUEPRINT_NAME } from "@/lib/domain/exam-blueprints";
import type { ExamBlueprintItemWeight } from "@/lib/domain/types";

type ExamRuleSnapshot = {
  levelId: string;
  singleCount: number;
  multipleCount: number;
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
};

/**
 * Create (or keep) the single default ExamBlueprint for a level from a legacy
 * ExamRule. Existing default blueprints are never duplicated.
 */
export async function ensureDefaultExamBlueprintFromExamRule(
  rule: ExamRuleSnapshot,
  weights: readonly ExamBlueprintItemWeight[] = [],
  fallbackKnowledgePointId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.examBlueprint.findFirst({ where: { levelId: rule.levelId, isDefault: true } });
    if (existing) return { created: false, blueprint: existing, items: [] as Array<{ knowledgePointId: string; singleCount: number; multipleCount: number }> };

    const blueprint = await tx.examBlueprint.create({ data: buildDefaultExamBlueprintInput(rule, rule.levelId) });
    const allocated = allocateExamBlueprintItems(rule, weights, fallbackKnowledgePointId);
    if (allocated.length > 0) {
      await tx.examBlueprintItem.createMany({ data: allocated.map((item) => ({ blueprintId: blueprint.id, ...item })) });
    }
    return { created: true, blueprint, items: allocated };
  });
}

export async function listExamBlueprints(levelId?: string) {
  return prisma.examBlueprint.findMany({
    where: levelId ? { levelId } : undefined,
    include: { items: { orderBy: { knowledgePointId: "asc" } } },
    orderBy: [{ levelId: "asc" }, { isDefault: "desc" }, { name: "asc" }],
  });
}

export { DEFAULT_EXAM_BLUEPRINT_NAME };
