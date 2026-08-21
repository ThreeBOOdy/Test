import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  stateFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    studentLevelQuestionState: { findMany: mocks.stateFindMany },
    $transaction: mocks.transaction,
  },
}));

import { createPracticeSession } from "@/lib/server/practice-service";

const activeLevel = { id: "level-a", code: "A", name: "A级", enabled: true };
const questionRecord = {
  id: "question-1",
  knowledgePointId: "point-1",
  sourceBankCode: null,
  externalQuestionCode: null,
  stem: "这是一道收藏题",
  type: "SINGLE_CHOICE" as const,
  optionCount: 2,
  correctOptionCount: 1,
  selectionSpec: "2选1",
  preserveOptionOrder: true,
  options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }],
  correctOptionIds: ["A"],
  status: "ACTIVE" as const,
  levels: [{ levelId: "level-a", level: { code: "A" } }],
  knowledgePoint: { name: "电波基础" },
};
const sessionRow = { id: "favorite-session-1", mode: "FAVORITE" as const, learningMode: false, status: "IN_PROGRESS" as const };

describe("favorite practice session service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: "level-a", activeLevel });
    mocks.transaction.mockImplementation(async (fn: (tx: object) => unknown) => {
      return fn({
        practiceSession: { create: vi.fn().mockResolvedValue(sessionRow) },
        practiceSessionQuestion: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      });
    });
  });

  it("creates a FAVORITE session using only favorite questions of the activeLevel", async () => {
    mocks.stateFindMany
      .mockResolvedValueOnce([{ questionId: "question-1", question: questionRecord }])
      .mockResolvedValueOnce([{ questionId: "question-1", levelId: "level-a", favorite: true, ignored: false }]);

    const session = await createPracticeSession("student-1", { mode: "favorite" });

    expect(session.mode).toBe("FAVORITE");
    expect(session.title).toBe("收藏题练习");
    expect(session.questions).toHaveLength(1);
    expect(session.questions[0]).toMatchObject({ id: "question-1", favorite: true, ignored: false });
    expect(mocks.stateFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ userId: "student-1", levelId: "level-a", favorite: true }),
    }));
  });

  it("rejects starting a favorite session when there are no favorites", async () => {
    mocks.stateFindMany.mockResolvedValue([]);

    await expect(createPracticeSession("student-1", { mode: "favorite" })).rejects.toMatchObject({
      status: 409,
      message: "当前没有收藏题目",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires an assigned activeLevel before creating a favorite session", async () => {
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: null, activeLevel: null });

    await expect(createPracticeSession("student-1", { mode: "favorite" })).rejects.toMatchObject({
      status: 403,
      message: "未分配题库，请联系老师",
    });
    expect(mocks.stateFindMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
