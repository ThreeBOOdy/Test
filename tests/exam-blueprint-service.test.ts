import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blueprintFindFirst: vi.fn(),
  blueprintCreate: vi.fn(),
  blueprintFindMany: vi.fn(),
  itemCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    examBlueprint: {
      findFirst: mocks.blueprintFindFirst,
      create: mocks.blueprintCreate,
      findMany: mocks.blueprintFindMany,
    },
    examBlueprintItem: {
      createMany: mocks.itemCreateMany,
    },
  },
}));

import { DEFAULT_EXAM_BLUEPRINT_NAME, ensureDefaultExamBlueprintFromExamRule, listExamBlueprints } from "@/lib/server/exam-blueprint-service";

const rule = {
  levelId: "level-a",
  singleCount: 32,
  multipleCount: 8,
  durationMinutes: 40,
  passingCount: 30,
  enabled: true,
};

const tx = {
  examBlueprint: {
    findFirst: mocks.blueprintFindFirst,
    create: mocks.blueprintCreate,
  },
  examBlueprintItem: {
    createMany: mocks.itemCreateMany,
  },
};

describe("exam blueprint service (issue #15)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
    mocks.blueprintCreate.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: "blueprint-1", ...args.data }));
    mocks.itemCreateMany.mockResolvedValue({ count: 2 });
  });

  it("creates a default blueprint and its split items from a legacy ExamRule", async () => {
    mocks.blueprintFindFirst.mockResolvedValue(null);

    const result = await ensureDefaultExamBlueprintFromExamRule(rule, [
      { knowledgePointId: "kp-1", singleWeight: 10, multipleWeight: 2 },
      { knowledgePointId: "kp-2", singleWeight: 6, multipleWeight: 6 },
    ]);

    expect(result.created).toBe(true);
    expect(mocks.blueprintCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        levelId: "level-a",
        name: DEFAULT_EXAM_BLUEPRINT_NAME,
        durationMinutes: 40,
        passingCount: 30,
        enabled: true,
        isDefault: true,
      }),
    });
    expect(mocks.itemCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ blueprintId: "blueprint-1", knowledgePointId: "kp-1", singleCount: 20, multipleCount: 2 }),
        expect.objectContaining({ blueprintId: "blueprint-1", knowledgePointId: "kp-2", singleCount: 12, multipleCount: 6 }),
      ]),
    });
    expect(result.items).toHaveLength(2);
  });

  it("does not duplicate an existing default blueprint", async () => {
    mocks.blueprintFindFirst.mockResolvedValue({ id: "blueprint-existing", levelId: "level-a", isDefault: true });

    const result = await ensureDefaultExamBlueprintFromExamRule(rule);

    expect(result.created).toBe(false);
    expect(result.blueprint).toEqual({ id: "blueprint-existing", levelId: "level-a", isDefault: true });
    expect(mocks.blueprintCreate).not.toHaveBeenCalled();
    expect(mocks.itemCreateMany).not.toHaveBeenCalled();
  });

  it("lists blueprints with their items", async () => {
    mocks.blueprintFindMany.mockResolvedValue([{ id: "blueprint-1", items: [] }]);

    const result = await listExamBlueprints("level-a");

    expect(result).toEqual([{ id: "blueprint-1", items: [] }]);
    expect(mocks.blueprintFindMany).toHaveBeenCalledWith({
      where: { levelId: "level-a" },
      include: { items: { orderBy: { knowledgePointId: "asc" } } },
      orderBy: [{ levelId: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    });
  });
});
