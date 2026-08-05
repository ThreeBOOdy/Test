import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importBatchUpdateMany: vi.fn(),
  importBatchFindFirstOrThrow: vi.fn(),
  levelFindMany: vi.fn(),
  auditInTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((callback: (tx: object) => unknown) => callback({
      importBatch: { updateMany: mocks.importBatchUpdateMany, findFirstOrThrow: mocks.importBatchFindFirstOrThrow },
      level: { findMany: mocks.levelFindMany },
    })),
  },
}));
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.auditInTransaction }));

import { commitImportBatch } from "@/lib/server/import-service";

describe("word import commit", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.importBatchUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditInTransaction.mockResolvedValue(undefined);
  });

  it("reports commit-time errors with the Word 第 N 题 location label", async () => {
    mocks.importBatchFindFirstOrThrow.mockResolvedValue({
      id: "batch-word",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      images: [],
      rows: [{
        rowNumber: 1,
        payload: {
          rowNumber: 1,
          locationLabel: "第 3 题",
          levelCode: "A",
          categoryCode: "4.1.1",
          stem: "题干",
          rawAnswer: "A",
          optionValues: { A: "选项A", B: "选项B" },
        },
        issues: [],
        valid: true,
      }],
    });
    mocks.levelFindMany.mockResolvedValue([]);

    await expect(commitImportBatch("teacher-1", "batch-word")).rejects.toThrow("第 3 题 等级 A 不存在或已停用");
  });

  it("keeps Excel worksheet locations for commit-time errors", async () => {
    mocks.importBatchFindFirstOrThrow.mockResolvedValue({
      id: "batch-excel",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      images: [],
      rows: [{
        rowNumber: 1,
        payload: {
          rowNumber: 2,
          sheetName: "题库",
          levelCode: "A",
          categoryCode: "4.1.1",
          stem: "题干",
          rawAnswer: "A",
          optionValues: { A: "选项A", B: "选项B" },
        },
        issues: [],
        valid: true,
      }],
    });
    mocks.levelFindMany.mockResolvedValue([]);

    await expect(commitImportBatch("teacher-1", "batch-excel")).rejects.toThrow("题库!2 等级 A 不存在或已停用");
  });
});
