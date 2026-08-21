import "server-only";
import { prisma } from "@/lib/db";
import {
  allocateExamBlueprintItems,
  buildDefaultExamBlueprintInput,
  DEFAULT_EXAM_BLUEPRINT_NAME,
  findExamBlueprintStockIssues,
  formatExamBlueprintStockIssue,
  validateExamBlueprint,
  validateExamBlueprintKnowledgePointOverlap,
} from "@/lib/domain/exam-blueprints";
import { getDescendantIds } from "@/lib/domain/knowledge-tree";
import { ApiError } from "@/lib/domain/api-error";
import type { ExamBlueprintItemWeight, KnowledgePoint, PracticeRule } from "@/lib/domain/types";
import { writeAuditLogInTransaction } from "@/lib/server/audit";

type ExamRuleSnapshot = {
  levelId: string;
  singleCount: number;
  multipleCount: number;
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
};

export type ExamBlueprintItemInput = {
  knowledgePointId: string;
  singleCount: number;
  multipleCount: number;
};

export type ExamBlueprintInput = {
  levelId: string;
  name: string;
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
  isDefault: boolean;
  items: ExamBlueprintItemInput[];
};

export type ExamBlueprintUpdateInput = Omit<ExamBlueprintInput, "levelId">;
export type ExamBlueprintCopyInput = {
  name?: string;
  levelId?: string;
};

type KnowledgePointRecord = Pick<KnowledgePoint, "id" | "code" | "name" | "parentId" | "enabled">;

const BLUEPRINT_ITEMS_INCLUDE = {
  items: {
    orderBy: { knowledgePointId: "asc" as const },
    include: {
      knowledgePoint: { select: { id: true, code: true, name: true, path: true } },
    },
  },
};

async function loadKnowledgePoints(): Promise<KnowledgePointRecord[]> {
  return prisma.knowledgePoint.findMany({
    select: { id: true, code: true, name: true, parentId: true, enabled: true },
  });
}

async function assertKnowledgePointSelection(
  items: readonly Pick<ExamBlueprintItemInput, "knowledgePointId">[],
  points: readonly KnowledgePointRecord[],
) {
  const pointById = new Map(points.map((point) => [point.id, point]));
  for (const item of items) {
    const point = pointById.get(item.knowledgePointId);
    if (!point) throw new ApiError("知识点不存在", 404);
    if (!point.enabled) throw new ApiError(`知识点已停用：${point.name}`, 409);
  }
  try {
    validateExamBlueprintKnowledgePointOverlap(items, points);
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "蓝图条目知识点配置无效");
  }
}

async function buildExamBlueprintInventory(
  levelId: string,
  items: readonly Pick<ExamBlueprintItemInput, "knowledgePointId">[],
  points: readonly KnowledgePointRecord[],
) {
  const selectedIds = [...new Set(items.map((item) => item.knowledgePointId))];
  const pointById = new Map(points.map((point) => [point.id, point]));

  const descendantIds = new Set<string>();
  for (const id of selectedIds) {
    const point = pointById.get(id);
    if (!point) throw new ApiError("知识点不存在", 404);
    if (!point.enabled) throw new ApiError(`知识点已停用：${point.name}`, 409);
    for (const descendantId of getDescendantIds(points, id)) descendantIds.add(descendantId);
  }

  const questions = await prisma.question.findMany({
    where: {
      levels: { some: { levelId } },
      status: "ACTIVE",
      knowledgePointId: { in: [...descendantIds] },
      knowledgePoint: { enabled: true },
    },
    select: { knowledgePointId: true, type: true },
  });

  const directInventory = new Map<string, PracticeRule>();
  for (const question of questions) {
    const current = directInventory.get(question.knowledgePointId) ?? { singleCount: 0, multipleCount: 0 };
    if (question.type === "SINGLE_CHOICE") current.singleCount += 1;
    else current.multipleCount += 1;
    directInventory.set(question.knowledgePointId, current);
  }

  const inventoryByPointId = new Map<string, PracticeRule>();
  for (const id of selectedIds) {
    const descendants = new Set(getDescendantIds(points, id));
    let singleCount = 0;
    let multipleCount = 0;
    for (const [pointId, counts] of directInventory) {
      if (descendants.has(pointId)) {
        singleCount += counts.singleCount;
        multipleCount += counts.multipleCount;
      }
    }
    inventoryByPointId.set(id, { singleCount, multipleCount });
  }

  return { inventoryByPointId, pointById };
}

async function assertBlueprintInput(input: ExamBlueprintInput) {
  try {
    validateExamBlueprint(input);
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "蓝图参数无效");
  }

  const level = await prisma.level.findUnique({
    where: { id: input.levelId },
    select: { id: true, enabled: true },
  });
  if (!level) throw new ApiError("字母类不存在", 404);
  if (!level.enabled) throw new ApiError("字母类已停用", 409);

  const points = await loadKnowledgePoints();
  await assertKnowledgePointSelection(input.items, points);

  const { inventoryByPointId, pointById } = await buildExamBlueprintInventory(input.levelId, input.items, points);
  const issues = findExamBlueprintStockIssues(input.items, inventoryByPointId, pointById);
  if (issues.length > 0) {
    throw new ApiError(issues.map((issue) => formatExamBlueprintStockIssue(issue)).join("；"), 409);
  }
}

function toItemInputs(items: Array<{ knowledgePointId: string; singleCount: number; multipleCount: number }>): ExamBlueprintItemInput[] {
  return items.map(({ knowledgePointId, singleCount, multipleCount }) => ({ knowledgePointId, singleCount, multipleCount }));
}

function createItemData(blueprintId: string, items: readonly ExamBlueprintItemInput[]) {
  return items.map((item) => ({ blueprintId, ...item }));
}

async function syncDefaultFlag(tx: { examBlueprint: { updateMany: (args: { where: Record<string, unknown>; data: { isDefault: boolean } }) => Promise<unknown> } }, levelId: string, excludeId?: string) {
  if (!excludeId) {
    await tx.examBlueprint.updateMany({ where: { levelId, isDefault: true }, data: { isDefault: false } });
  } else {
    await tx.examBlueprint.updateMany({ where: { levelId, isDefault: true, id: { not: excludeId } }, data: { isDefault: false } });
  }
}

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
    include: BLUEPRINT_ITEMS_INCLUDE,
    orderBy: [{ levelId: "asc" }, { isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getExamBlueprint(id: string) {
  return prisma.examBlueprint.findUnique({
    where: { id },
    include: BLUEPRINT_ITEMS_INCLUDE,
  });
}

export async function createExamBlueprint(actorUserId: string, input: ExamBlueprintInput) {
  await assertBlueprintInput(input);

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await syncDefaultFlag(tx, input.levelId);
    const blueprint = await tx.examBlueprint.create({
      data: {
        levelId: input.levelId,
        name: input.name,
        durationMinutes: input.durationMinutes,
        passingCount: input.passingCount,
        enabled: input.enabled,
        isDefault: input.isDefault,
      },
    });
    if (input.items.length > 0) {
      await tx.examBlueprintItem.createMany({ data: createItemData(blueprint.id, input.items) });
    }
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_CREATE",
      targetType: "ExamBlueprint",
      targetId: blueprint.id,
      metadata: { levelId: input.levelId, name: input.name, isDefault: input.isDefault, itemCount: input.items.length },
    });
    return blueprint;
  });
}

export async function copyExamBlueprint(actorUserId: string, sourceId: string, input: ExamBlueprintCopyInput = {}) {
  const source = await prisma.examBlueprint.findUnique({
    where: { id: sourceId },
    include: { items: true },
  });
  if (!source) throw new ApiError("蓝图不存在", 404);

  const targetLevelId = input.levelId ?? source.levelId;
  const targetName = input.name?.trim() || `${source.name}（副本）`;
  const targetInput: ExamBlueprintInput = {
    levelId: targetLevelId,
    name: targetName,
    durationMinutes: source.durationMinutes,
    passingCount: source.passingCount,
    enabled: source.enabled,
    isDefault: false,
    items: toItemInputs(source.items),
  };
  await assertBlueprintInput(targetInput);

  return prisma.$transaction(async (tx) => {
    const blueprint = await tx.examBlueprint.create({
      data: {
        levelId: targetInput.levelId,
        name: targetInput.name,
        durationMinutes: targetInput.durationMinutes,
        passingCount: targetInput.passingCount,
        enabled: targetInput.enabled,
        isDefault: false,
      },
    });
    if (targetInput.items.length > 0) {
      await tx.examBlueprintItem.createMany({ data: createItemData(blueprint.id, targetInput.items) });
    }
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_COPY",
      targetType: "ExamBlueprint",
      targetId: blueprint.id,
      metadata: { sourceId, levelId: targetInput.levelId, name: targetInput.name },
    });
    return blueprint;
  });
}

export async function updateExamBlueprint(actorUserId: string, id: string, input: ExamBlueprintUpdateInput) {
  const existing = await prisma.examBlueprint.findUnique({
    where: { id },
    select: { id: true, levelId: true },
  });
  if (!existing) throw new ApiError("蓝图不存在", 404);

  const fullInput: ExamBlueprintInput = { ...input, levelId: existing.levelId };
  await assertBlueprintInput(fullInput);

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await syncDefaultFlag(tx, existing.levelId, id);
    const blueprint = await tx.examBlueprint.update({
      where: { id },
      data: {
        name: input.name,
        durationMinutes: input.durationMinutes,
        passingCount: input.passingCount,
        enabled: input.enabled,
        isDefault: input.isDefault,
      },
    });
    await tx.examBlueprintItem.deleteMany({ where: { blueprintId: id } });
    if (input.items.length > 0) {
      await tx.examBlueprintItem.createMany({ data: createItemData(id, input.items) });
    }
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_UPDATE",
      targetType: "ExamBlueprint",
      targetId: id,
      metadata: { levelId: existing.levelId, name: input.name, isDefault: input.isDefault, itemCount: input.items.length },
    });
    return blueprint;
  });
}

export async function deleteExamBlueprint(actorUserId: string, id: string) {
  const existing = await prisma.examBlueprint.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new ApiError("蓝图不存在", 404);

  await prisma.$transaction(async (tx) => {
    await tx.examBlueprint.delete({ where: { id } });
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_DELETE",
      targetType: "ExamBlueprint",
      targetId: id,
      metadata: {},
    });
  });
  return { deleted: true };
}

async function getBlueprintWithItems(id: string) {
  const blueprint = await prisma.examBlueprint.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!blueprint) throw new ApiError("蓝图不存在", 404);
  return blueprint;
}

export async function addExamBlueprintItem(actorUserId: string, blueprintId: string, item: ExamBlueprintItemInput) {
  const blueprint = await getBlueprintWithItems(blueprintId);
  const proposedItems = [...toItemInputs(blueprint.items), item];
  const fullInput: ExamBlueprintInput = {
    levelId: blueprint.levelId,
    name: blueprint.name,
    durationMinutes: blueprint.durationMinutes,
    passingCount: blueprint.passingCount,
    enabled: blueprint.enabled,
    isDefault: blueprint.isDefault,
    items: proposedItems,
  };
  await assertBlueprintInput(fullInput);

  return prisma.$transaction(async (tx) => {
    const created = await tx.examBlueprintItem.create({
      data: { blueprintId, ...item },
    });
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_ITEM_CREATE",
      targetType: "ExamBlueprintItem",
      targetId: created.id,
      metadata: { blueprintId, knowledgePointId: item.knowledgePointId, singleCount: item.singleCount, multipleCount: item.multipleCount },
    });
    return created;
  });
}

export async function updateExamBlueprintItem(actorUserId: string, blueprintId: string, itemId: string, item: ExamBlueprintItemInput) {
  const blueprint = await getBlueprintWithItems(blueprintId);
  const existingItem = blueprint.items.find((candidate) => candidate.id === itemId);
  if (!existingItem) throw new ApiError("蓝图条目不存在", 404);

  const proposedItems = blueprint.items.map((candidate) =>
    candidate.id === itemId ? item : { knowledgePointId: candidate.knowledgePointId, singleCount: candidate.singleCount, multipleCount: candidate.multipleCount },
  );
  const fullInput: ExamBlueprintInput = {
    levelId: blueprint.levelId,
    name: blueprint.name,
    durationMinutes: blueprint.durationMinutes,
    passingCount: blueprint.passingCount,
    enabled: blueprint.enabled,
    isDefault: blueprint.isDefault,
    items: proposedItems,
  };
  await assertBlueprintInput(fullInput);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.examBlueprintItem.update({
      where: { id: itemId },
      data: { knowledgePointId: item.knowledgePointId, singleCount: item.singleCount, multipleCount: item.multipleCount },
    });
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_ITEM_UPDATE",
      targetType: "ExamBlueprintItem",
      targetId: itemId,
      metadata: { blueprintId, knowledgePointId: item.knowledgePointId, singleCount: item.singleCount, multipleCount: item.multipleCount },
    });
    return updated;
  });
}

export async function deleteExamBlueprintItem(actorUserId: string, blueprintId: string, itemId: string) {
  const blueprint = await getBlueprintWithItems(blueprintId);
  const existingItem = blueprint.items.find((candidate) => candidate.id === itemId);
  if (!existingItem) throw new ApiError("蓝图条目不存在", 404);

  const proposedItems = blueprint.items
    .filter((candidate) => candidate.id !== itemId)
    .map((candidate) => ({ knowledgePointId: candidate.knowledgePointId, singleCount: candidate.singleCount, multipleCount: candidate.multipleCount }));
  const fullInput: ExamBlueprintInput = {
    levelId: blueprint.levelId,
    name: blueprint.name,
    durationMinutes: blueprint.durationMinutes,
    passingCount: blueprint.passingCount,
    enabled: blueprint.enabled,
    isDefault: blueprint.isDefault,
    items: proposedItems,
  };
  await assertBlueprintInput(fullInput);

  return prisma.$transaction(async (tx) => {
    await tx.examBlueprintItem.delete({ where: { id: itemId } });
    await writeAuditLogInTransaction(tx, {
      actorUserId,
      action: "EXAM_BLUEPRINT_ITEM_DELETE",
      targetType: "ExamBlueprintItem",
      targetId: itemId,
      metadata: { blueprintId },
    });
    return { deleted: true };
  });
}

export { DEFAULT_EXAM_BLUEPRINT_NAME };
