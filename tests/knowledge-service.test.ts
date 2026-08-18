import { describe, expect, it, vi } from "vitest";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";

type StoredPoint = {
  id: string;
  typeId: string;
  code: string;
  name: string;
  path: string;
  depth: number;
  sortOrder: number;
  enabled: boolean;
  version: number;
  parentId: string | null;
  _count: { questions: number };
};

function createTransaction(initialPoints: StoredPoint[] = []) {
  const store = new Map<string, StoredPoint>();
  for (const point of initialPoints) store.set(`${point.typeId}:${point.code}`, { ...point });
  let nextId = initialPoints.length + 1;

  const findFirst = vi.fn(async ({ where }: { where: { typeId: string; code: string } }): Promise<StoredPoint | null> => {
    return store.get(`${where.typeId}:${where.code}`) ?? null;
  });

  const upsert = vi.fn(async ({ where, update, create }: {
    where: { typeId_code: { typeId: string; code: string } };
    update: Partial<StoredPoint>;
    create: Omit<StoredPoint, "id" | "version" | "_count">;
  }): Promise<StoredPoint> => {
    const key = `${where.typeId_code.typeId}:${where.typeId_code.code}`;
    const existing = store.get(key);
    if (existing) {
      const next = {
        ...existing,
        ...(update.name !== undefined ? { name: update.name } : {}),
        ...(update.sortOrder !== undefined ? { sortOrder: update.sortOrder } : {}),
        version: existing.version + 1,
      };
      store.set(key, next);
      return next;
    }
    const point: StoredPoint = {
      id: `kp-${nextId++}`,
      typeId: where.typeId_code.typeId,
      code: where.typeId_code.code,
      name: create.name,
      path: create.path,
      depth: create.depth,
      sortOrder: create.sortOrder,
      enabled: create.enabled,
      version: 1,
      parentId: create.parentId,
      _count: { questions: 0 },
    };
    store.set(key, point);
    return point;
  });

  const tx = {
    knowledgePoint: { findFirst, upsert },
  } as unknown as Parameters<typeof ensureKnowledgePoint>[0];

  return { tx, findFirst, upsert, store };
}

describe("ensureKnowledgePoint", () => {
  it("reuses an existing parent node instead of creating a duplicate", async () => {
    const parent: StoredPoint = {
      id: "kp-4-1",
      typeId: "type-dg",
      code: "4.1",
      name: "4.1",
      path: "/4/4.1",
      depth: 1,
      sortOrder: 0,
      enabled: true,
      version: 1,
      parentId: "kp-4",
      _count: { questions: 0 },
    };
    const { tx, store } = createTransaction([parent]);

    const leaf = await ensureKnowledgePoint(tx, "4.1.2", "导体和绝缘体", 2, "type-dg");

    expect(leaf.id).toBe("kp-3");
    expect(leaf.parentId).toBe("kp-4-1");
    expect(store.get("type-dg:4.1")?.id).toBe("kp-4-1");
    expect(store.size).toBe(3);
    expect(store.get("type-dg:4")?.code).toBe("4");
    expect(store.get("type-dg:4.1.2")?.code).toBe("4.1.2");
  });

  it("inserts a partial subtree by creating every missing ancestor", async () => {
    const { tx, store } = createTransaction();

    const leaf = await ensureKnowledgePoint(tx, "4.1.2", "叶子节点", 5, "type-dg");

    expect([...store.keys()].sort()).toEqual(["type-dg:4", "type-dg:4.1", "type-dg:4.1.2"]);
    expect(store.get("type-dg:4")?.parentId).toBeNull();
    expect(store.get("type-dg:4.1")?.parentId).toBe(store.get("type-dg:4")?.id);
    expect(leaf.parentId).toBe(store.get("type-dg:4.1")?.id);
    expect(leaf.depth).toBe(2);
    expect(leaf.path).toBe("/4/4.1/4.1.2");
  });

  it("accepts non-numeric classification codes with Chinese and slash separators", async () => {
    const { tx, store } = createTransaction();

    const leaf = await ensureKnowledgePoint(tx, "模块一/1.1", "示例知识点", 1, "type-dg");

    expect(leaf.code).toBe("模块一/1.1");
    expect([...store.keys()].sort()).toEqual([
      "type-dg:模块一",
      "type-dg:模块一/1",
      "type-dg:模块一/1.1",
    ]);
    expect(store.get("type-dg:模块一")?.depth).toBe(0);
    expect(store.get("type-dg:模块一/1")?.depth).toBe(1);
    expect(leaf.parentId).toBe(store.get("type-dg:模块一/1")?.id);
  });

  it("keeps the same classification code independent across knowledge point types", async () => {
    const { tx, store } = createTransaction();

    await ensureKnowledgePoint(tx, "K.1", "甲类型叶子", 0, "type-a");
    await ensureKnowledgePoint(tx, "K.1", "乙类型叶子", 0, "type-b");

    expect(store.get("type-a:K.1")?.parentId).toBe(store.get("type-a:K")?.id);
    expect(store.get("type-b:K.1")?.parentId).toBe(store.get("type-b:K")?.id);
    expect(store.get("type-a:K.1")?.id).not.toBe(store.get("type-b:K.1")?.id);
  });
});
