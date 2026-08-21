import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  levelFindUnique: vi.fn(),
  knowledgePointFindMany: vi.fn(),
  questionFindMany: vi.fn(),
  blueprintFindUnique: vi.fn(),
  blueprintCreate: vi.fn(),
  blueprintUpdate: vi.fn(),
  blueprintDelete: vi.fn(),
  blueprintUpdateMany: vi.fn(),
  itemCreateMany: vi.fn(),
  itemDeleteMany: vi.fn(),
  itemCreate: vi.fn(),
  itemUpdate: vi.fn(),
  itemDelete: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    level: { findUnique: mocks.levelFindUnique },
    knowledgePoint: { findMany: mocks.knowledgePointFindMany },
    question: { findMany: mocks.questionFindMany },
    examBlueprint: {
      findUnique: mocks.blueprintFindUnique,
      create: mocks.blueprintCreate,
      update: mocks.blueprintUpdate,
      delete: mocks.blueprintDelete,
      updateMany: mocks.blueprintUpdateMany,
    },
    examBlueprintItem: {
      createMany: mocks.itemCreateMany,
      deleteMany: mocks.itemDeleteMany,
      create: mocks.itemCreate,
      update: mocks.itemUpdate,
      delete: mocks.itemDelete,
    },
  },
}));

vi.mock("@/lib/server/audit", () => ({
  writeAuditLogInTransaction: mocks.audit,
}));

import {
  addExamBlueprintItem,
  copyExamBlueprint,
  createExamBlueprint,
  deleteExamBlueprint,
  deleteExamBlueprintItem,
  updateExamBlueprint,
  updateExamBlueprintItem,
} from "@/lib/server/exam-blueprint-service";

const points = [
  { id: "kp-root", code: "1", name: "无线电基础", parentId: null, enabled: true },
  { id: "kp-leaf", code: "1.1", name: "电波基础", parentId: "kp-root", enabled: true },
  { id: "kp-other", code: "2", name: "通信原理", parentId: null, enabled: true },
];

const questions = [
  { knowledgePointId: "kp-leaf", type: "SINGLE_CHOICE" as const },
  { knowledgePointId: "kp-other", type: "SINGLE_CHOICE" as const },
  { knowledgePointId: "kp-other", type: "SINGLE_CHOICE" as const },
];

const existingBlueprint = {
  id: "blueprint-1",
  levelId: "level-a",
  name: "期中模拟",
  durationMinutes: 40,
  passingCount: 1,
  enabled: true,
  isDefault: false,
  items: [
    { id: "item-1", blueprintId: "blueprint-1", knowledgePointId: "kp-leaf", singleCount: 1, multipleCount: 0 },
  ],
};

const tx = {
  examBlueprint: {
    create: mocks.blueprintCreate,
    update: mocks.blueprintUpdate,
    delete: mocks.blueprintDelete,
    updateMany: mocks.blueprintUpdateMany,
  },
  examBlueprintItem: {
    createMany: mocks.itemCreateMany,
    deleteMany: mocks.itemDeleteMany,
    create: mocks.itemCreate,
    update: mocks.itemUpdate,
    delete: mocks.itemDelete,
  },
};

function validCreateInput() {
  return {
    levelId: "level-a",
    name: "期中模拟",
    durationMinutes: 40,
    passingCount: 1,
    enabled: true,
    isDefault: false,
    items: [{ knowledgePointId: "kp-root", singleCount: 1, multipleCount: 0 }],
  };
}

describe("exam blueprint CRUD service (issue #19)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.levelFindUnique.mockResolvedValue({ id: "level-a", enabled: true });
    mocks.knowledgePointFindMany.mockResolvedValue(points);
    mocks.questionFindMany.mockResolvedValue(questions);
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
    mocks.blueprintCreate.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: "blueprint-1", ...args.data }));
    mocks.blueprintUpdate.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: "blueprint-1", ...args.data }));
    mocks.blueprintDelete.mockResolvedValue({ id: "blueprint-1" });
    mocks.blueprintUpdateMany.mockResolvedValue({ count: 0 });
    mocks.itemCreateMany.mockResolvedValue({ count: 1 });
    mocks.itemDeleteMany.mockResolvedValue({ count: 0 });
    mocks.itemCreate.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: "item-new", ...args.data }));
    mocks.itemUpdate.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: "item-1", ...args.data }));
    mocks.itemDelete.mockResolvedValue({ id: "item-1" });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("creates a blueprint with items and writes audit", async () => {
    const result = await createExamBlueprint("user-1", validCreateInput());

    expect(result.id).toBe("blueprint-1");
    expect(mocks.blueprintCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ levelId: "level-a", name: "期中模拟", passingCount: 1, isDefault: false }),
    });
    expect(mocks.itemCreateMany).toHaveBeenCalledWith({
      data: [{ blueprintId: "blueprint-1", knowledgePointId: "kp-root", singleCount: 1, multipleCount: 0 }],
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "EXAM_BLUEPRINT_CREATE" }));
  });

  it("rejects ancestor/descendant knowledge point overlap", async () => {
    const input = validCreateInput();
    input.items = [
      { knowledgePointId: "kp-root", singleCount: 1, multipleCount: 0 },
      { knowledgePointId: "kp-leaf", singleCount: 1, multipleCount: 0 },
    ];

    await expect(createExamBlueprint("user-1", input)).rejects.toThrow("蓝图条目知识点存在父子重叠");
    expect(mocks.blueprintCreate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a clear error when inventory is insufficient", async () => {
    mocks.questionFindMany.mockResolvedValue([]);
    const input = validCreateInput();

    await expect(createExamBlueprint("user-1", input)).rejects.toThrow("无线电基础");
    await expect(createExamBlueprint("user-1", input)).rejects.toThrow("单选");
    await expect(createExamBlueprint("user-1", input)).rejects.toThrow("缺少 1 题");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("copies a blueprint with default copied name and its items", async () => {
    mocks.blueprintFindUnique.mockResolvedValue(existingBlueprint);

    const result = await copyExamBlueprint("user-1", "blueprint-1");

    expect(result.id).toBe("blueprint-1");
    expect(mocks.blueprintCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "期中模拟（副本）", isDefault: false, levelId: "level-a" }),
    });
    expect(mocks.itemCreateMany).toHaveBeenCalledWith({
      data: [{ blueprintId: "blueprint-1", knowledgePointId: "kp-leaf", singleCount: 1, multipleCount: 0 }],
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "EXAM_BLUEPRINT_COPY" }));
  });

  it("updates a blueprint by replacing its items", async () => {
    mocks.blueprintFindUnique.mockResolvedValue({ id: "blueprint-1", levelId: "level-a" });

    const result = await updateExamBlueprint("user-1", "blueprint-1", {
      name: "期末模拟",
      durationMinutes: 60,
      passingCount: 2,
      enabled: true,
      isDefault: true,
      items: [{ knowledgePointId: "kp-other", singleCount: 2, multipleCount: 0 }],
    });

    expect(result.id).toBe("blueprint-1");
    expect(mocks.blueprintUpdate).toHaveBeenCalledWith({
      where: { id: "blueprint-1" },
      data: expect.objectContaining({ name: "期末模拟", durationMinutes: 60, passingCount: 2, isDefault: true }),
    });
    expect(mocks.itemDeleteMany).toHaveBeenCalledWith({ where: { blueprintId: "blueprint-1" } });
    expect(mocks.itemCreateMany).toHaveBeenCalledWith({
      data: [{ blueprintId: "blueprint-1", knowledgePointId: "kp-other", singleCount: 2, multipleCount: 0 }],
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "EXAM_BLUEPRINT_UPDATE" }));
  });

  it("deletes a blueprint and writes audit", async () => {
    mocks.blueprintFindUnique.mockResolvedValue({ id: "blueprint-1" });

    const result = await deleteExamBlueprint("user-1", "blueprint-1");

    expect(result).toEqual({ deleted: true });
    expect(mocks.blueprintDelete).toHaveBeenCalledWith({ where: { id: "blueprint-1" } });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "EXAM_BLUEPRINT_DELETE" }));
  });

  it("adds an item to a blueprint after validating the full set", async () => {
    mocks.blueprintFindUnique.mockResolvedValue(existingBlueprint);

    const result = await addExamBlueprintItem("user-1", "blueprint-1", {
      knowledgePointId: "kp-other",
      singleCount: 1,
      multipleCount: 0,
    });

    expect(result.id).toBe("item-new");
    expect(mocks.itemCreate).toHaveBeenCalledWith({
      data: { blueprintId: "blueprint-1", knowledgePointId: "kp-other", singleCount: 1, multipleCount: 0 },
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "EXAM_BLUEPRINT_ITEM_CREATE" }));
  });

  it("updates an item after validating overlap and inventory", async () => {
    mocks.blueprintFindUnique.mockResolvedValue(existingBlueprint);

    const result = await updateExamBlueprintItem("user-1", "blueprint-1", "item-1", {
      knowledgePointId: "kp-other",
      singleCount: 1,
      multipleCount: 0,
    });

    expect(result.id).toBe("item-1");
    expect(mocks.itemUpdate).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { knowledgePointId: "kp-other", singleCount: 1, multipleCount: 0 },
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "EXAM_BLUEPRINT_ITEM_UPDATE" }));
  });

  it("does not delete the last item because the blueprint must keep at least one item", async () => {
    mocks.blueprintFindUnique.mockResolvedValue(existingBlueprint);

    await expect(deleteExamBlueprintItem("user-1", "blueprint-1", "item-1")).rejects.toThrow("蓝图至少需要一个条目");
    expect(mocks.itemDelete).not.toHaveBeenCalled();
  });
});
