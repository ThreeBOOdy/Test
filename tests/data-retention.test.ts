import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  authSessionCount: vi.fn(), authSessionFindMany: vi.fn(), authSessionDeleteMany: vi.fn(),
  activationCount: vi.fn(), activationFindMany: vi.fn(), activationDeleteMany: vi.fn(),
  studentImportCount: vi.fn(), studentImportFindMany: vi.fn(), studentImportDeleteMany: vi.fn(),
  questionImportCount: vi.fn(), questionImportFindMany: vi.fn(), questionImportDeleteMany: vi.fn(),
  examDraftCount: vi.fn(), examDraftFindMany: vi.fn(), examDraftDeleteMany: vi.fn(),
}));

import { cleanupTemporaryData } from "@/lib/server/data-retention-service";

const now = new Date("2026-07-31T00:00:00.000Z");
const finders = [mocks.authSessionFindMany, mocks.activationFindMany, mocks.studentImportFindMany, mocks.questionImportFindMany, mocks.examDraftFindMany];
const counters = [mocks.authSessionCount, mocks.activationCount, mocks.studentImportCount, mocks.questionImportCount, mocks.examDraftCount];
const removers = [mocks.authSessionDeleteMany, mocks.activationDeleteMany, mocks.studentImportDeleteMany, mocks.questionImportDeleteMany, mocks.examDraftDeleteMany];

function client() {
  return {
    auditLog: { create: mocks.auditCreate },
    authSession: { count: mocks.authSessionCount, findMany: mocks.authSessionFindMany, deleteMany: mocks.authSessionDeleteMany },
    studentActivation: { count: mocks.activationCount, findMany: mocks.activationFindMany, deleteMany: mocks.activationDeleteMany },
    studentImportBatch: { count: mocks.studentImportCount, findMany: mocks.studentImportFindMany, deleteMany: mocks.studentImportDeleteMany },
    importBatch: { count: mocks.questionImportCount, findMany: mocks.questionImportFindMany, deleteMany: mocks.questionImportDeleteMany },
    examDraft: { count: mocks.examDraftCount, findMany: mocks.examDraftFindMany, deleteMany: mocks.examDraftDeleteMany },
  };
}

function configureSuccessfulCleanup() {
  for (const count of counters) count.mockResolvedValue(0);
  for (const find of finders) find.mockResolvedValue([]);
  for (const remove of removers) remove.mockResolvedValue({ count: 0 });
  mocks.auditCreate.mockResolvedValue({});
}

describe("temporary data retention service", () => {
  beforeEach(() => { vi.clearAllMocks(); configureSuccessfulCleanup(); });

  it("audits one category failure, continues other categories, and retries it next run", async () => {
    mocks.authSessionCount.mockRejectedValueOnce(new Error("session storage unavailable"));
    const first = await cleanupTemporaryData(client() as never, now);
    expect(first.results.map((result) => result.category)).toEqual(["studentActivations", "studentImportPreviews", "questionImportPreviews", "settledExamDrafts"]);
    expect(first.failures).toEqual([{ category: "authSessions", message: "session storage unavailable", auditRecorded: true }]);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "RETENTION_CLEANUP_FAILED", targetId: "authSessions", metadata: expect.objectContaining({ durationMs: expect.any(Number) }) }) }));
    const second = await cleanupTemporaryData(client() as never, now);
    expect(second.failures).toEqual([]);
    expect(second.results.map((result) => result.category)).toEqual(["authSessions", "studentActivations", "studentImportPreviews", "questionImportPreviews", "settledExamDrafts"]);
  });

  it("deletes eligible records in bounded batches", async () => {
    mocks.authSessionCount.mockResolvedValueOnce(501).mockResolvedValueOnce(0);
    mocks.authSessionFindMany.mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ id: `session-${index}` }))).mockResolvedValueOnce([{ id: "session-500" }]);
    mocks.authSessionDeleteMany.mockResolvedValueOnce({ count: 500 }).mockResolvedValueOnce({ count: 1 });
    const result = await cleanupTemporaryData(client() as never, now);
    expect(result.results.find((item) => item.category === "authSessions")).toMatchObject({ eligibleBefore: 501, deleted: 501, remaining: 0 });
    expect(mocks.authSessionFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.authSessionDeleteMany).toHaveBeenCalledTimes(2);
  });
});
