import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  questionFindMany: vi.fn(),
  levelFindMany: vi.fn(),
  questionLevelFindMany: vi.fn(),
  questionLevelCreateMany: vi.fn(),
  questionLevelDeleteMany: vi.fn(),
  writeAuditLogInTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((callback: (transaction: object) => unknown) => callback({
      question: { findMany: mocks.questionFindMany },
      level: { findMany: mocks.levelFindMany },
      questionLevel: {
        findMany: mocks.questionLevelFindMany,
        createMany: mocks.questionLevelCreateMany,
        deleteMany: mocks.questionLevelDeleteMany,
      },
    })),
  },
}));
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.writeAuditLogInTransaction }));

import { assignQuestionLevels, removeQuestionLevels } from "@/lib/server/question-level-service";

describe("question level classification service (S7)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.writeAuditLogInTransaction.mockResolvedValue(undefined);
  });

  it("assigns multiple letter classes to one question", async () => {
    mocks.questionFindMany.mockResolvedValue([{ id: "q1", status: "ACTIVE" }]);
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a" }, { id: "level-k" }]);
    mocks.questionLevelFindMany.mockResolvedValue([]);
    mocks.questionLevelCreateMany.mockResolvedValue({ count: 2 });

    const result = await assignQuestionLevels("teacher-1", ["q1"], ["level-a", "level-k"]);

    expect(result).toEqual({ assigned: 2, skippedDuplicates: 0 });
    expect(mocks.questionLevelCreateMany).toHaveBeenCalledWith({
      data: [
        { questionId: "q1", levelId: "level-a" },
        { questionId: "q1", levelId: "level-k" },
      ],
      skipDuplicates: true,
    });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "QUESTION_LEVEL_ASSIGN", targetId: "q1", metadata: expect.objectContaining({ levelIds: ["level-a", "level-k"], assigned: 2 }) }),
    );
  });

  it("batch assigns multiple questions to multiple letter classes", async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: "q1", status: "ACTIVE" },
      { id: "q2", status: "ACTIVE" },
    ]);
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a" }, { id: "level-k" }]);
    mocks.questionLevelFindMany.mockResolvedValue([]);
    mocks.questionLevelCreateMany.mockResolvedValue({ count: 4 });

    const result = await assignQuestionLevels("teacher-1", ["q1", "q2"], ["level-a", "level-k"]);

    expect(result).toEqual({ assigned: 4, skippedDuplicates: 0 });
    expect(mocks.questionLevelCreateMany.mock.calls[0][0].data).toHaveLength(4);
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledTimes(2);
  });

  it("skips duplicate existing associations and reports skipped duplicates", async () => {
    mocks.questionFindMany.mockResolvedValue([{ id: "q1", status: "ACTIVE" }]);
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a" }, { id: "level-k" }]);
    mocks.questionLevelFindMany.mockResolvedValue([{ questionId: "q1", levelId: "level-a" }]);
    mocks.questionLevelCreateMany.mockResolvedValue({ count: 1 });

    const result = await assignQuestionLevels("teacher-1", ["q1"], ["level-a", "level-k"]);

    expect(result).toEqual({ assigned: 1, skippedDuplicates: 1 });
    const data = mocks.questionLevelCreateMany.mock.calls[0][0].data as Array<{ questionId: string; levelId: string }>;
    expect(data).toHaveLength(1);
    expect(data).not.toContainEqual({ questionId: "q1", levelId: "level-a" });
  });

  it("removes all classifications so a question becomes unclassified", async () => {
    mocks.questionFindMany.mockResolvedValue([{ id: "q1", status: "ACTIVE" }]);
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a" }, { id: "level-k" }]);
    mocks.questionLevelFindMany.mockResolvedValue([
      { questionId: "q1", levelId: "level-a" },
      { questionId: "q1", levelId: "level-k" },
    ]);
    mocks.questionLevelDeleteMany.mockResolvedValue({ count: 2 });

    const result = await removeQuestionLevels("teacher-1", ["q1"], ["level-a", "level-k"]);

    expect(result).toEqual({ removed: 2 });
    expect(mocks.questionLevelDeleteMany).toHaveBeenCalledWith({
      where: { questionId: { in: ["q1"] }, levelId: { in: ["level-a", "level-k"] } },
    });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "QUESTION_LEVEL_REMOVE", targetId: "q1", metadata: expect.objectContaining({ removed: 2 }) }),
    );
  });

  it("batch removes a letter class from multiple questions", async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: "q1", status: "ACTIVE" },
      { id: "q2", status: "ACTIVE" },
    ]);
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a" }]);
    mocks.questionLevelFindMany.mockResolvedValue([
      { questionId: "q1", levelId: "level-a" },
      { questionId: "q2", levelId: "level-a" },
    ]);
    mocks.questionLevelDeleteMany.mockResolvedValue({ count: 2 });

    const result = await removeQuestionLevels("teacher-1", ["q1", "q2"], ["level-a"]);

    expect(result).toEqual({ removed: 2 });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledTimes(2);
  });

  it("rejects archived questions when assigning", async () => {
    mocks.questionFindMany.mockResolvedValue([{ id: "q1", status: "ARCHIVED" }]);

    await expect(assignQuestionLevels("teacher-1", ["q1"], ["level-a"])).rejects.toMatchObject({ status: 409 });
    expect(mocks.questionLevelCreateMany).not.toHaveBeenCalled();
  });

  it("rejects missing questions when removing", async () => {
    mocks.questionFindMany.mockResolvedValue([{ id: "q1", status: "ACTIVE" }]);

    await expect(removeQuestionLevels("teacher-1", ["q1", "missing"], ["level-a"])).rejects.toMatchObject({ status: 404 });
    expect(mocks.questionLevelDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects disabled levels on assignment", async () => {
    mocks.questionFindMany.mockResolvedValue([{ id: "q1", status: "ACTIVE" }]);
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a" }]);

    await expect(assignQuestionLevels("teacher-1", ["q1"], ["level-a", "level-k"])).rejects.toMatchObject({ status: 404 });
    expect(mocks.questionLevelCreateMany).not.toHaveBeenCalled();
  });
});
