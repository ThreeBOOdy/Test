import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importBatchFindFirst: vi.fn(),
  questionFindMany: vi.fn(),
  questionUpdateMany: vi.fn(),
  questionRevisionCreateMany: vi.fn(),
  importBatchUpdate: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((callback: (transaction: object) => unknown) => callback({
      importBatch: { findFirst: mocks.importBatchFindFirst, update: mocks.importBatchUpdate },
      question: { findMany: mocks.questionFindMany, updateMany: mocks.questionUpdateMany },
      questionRevision: { createMany: mocks.questionRevisionCreateMany },
    })),
  },
}));
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.audit }));

import { revertImportBatch } from "@/lib/server/import-service";

describe("archive-only question lifecycle", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.importBatchFindFirst.mockResolvedValue({ id: "batch-1", status: "COMMITTED" });
    mocks.questionFindMany.mockResolvedValue([{ id: "question-1", version: 4, levelId: "level-1", knowledgePointId: "point-1", sourceBankCode: null, externalQuestionCode: "Q-1", stem: "题干", preserveOptionOrder: false, options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }], correctOptionIds: ["A"] }]);
    mocks.questionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.questionRevisionCreateMany.mockResolvedValue({ count: 1 });
    mocks.importBatchUpdate.mockResolvedValue({});
    mocks.audit.mockResolvedValue(undefined);
  });

  it("archives every imported public question and retains a revision when reverting a batch", async () => {
    await expect(revertImportBatch("batch-1", "teacher-1")).resolves.toEqual({ archived: 1 });

    expect(mocks.questionFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ importBatchId: "batch-1", status: { not: "ARCHIVED" } }) }));
    expect(mocks.questionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "ARCHIVED", version: { increment: 1 } } }));
    expect(mocks.questionRevisionCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ questionId: "question-1", revision: 5, changeSource: "IMPORT_REVERT_ARCHIVE", snapshot: expect.objectContaining({ status: "ARCHIVED" }) })] });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "IMPORT_REVERT", metadata: { archived: 1 } }));
  });

  it("has no physical question deletion path in import reverts", () => {
    const service = readFileSync(path.resolve("lib/server/import-service.ts"), "utf8");

    expect(service).not.toMatch(/question\.delete(?:Many)?\(/);
  });
});
