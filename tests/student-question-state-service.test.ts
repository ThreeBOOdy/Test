import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  questionFindFirst: vi.fn(),
  stateUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    question: { findFirst: mocks.questionFindFirst },
    studentLevelQuestionState: { upsert: mocks.stateUpsert },
  },
}));

import { setStudentQuestionState } from "@/lib/server/student-question-state-service";

const activeLevel = { id: "level-a", code: "A", name: "A级", enabled: true };

describe("student question state service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: "level-a", activeLevel });
    mocks.questionFindFirst.mockResolvedValue({ id: "q1" });
    mocks.stateUpsert.mockResolvedValue({ favorite: false, ignored: false });
  });

  it("sets favorite and auto-creates a state record for the current active level", async () => {
    mocks.stateUpsert.mockResolvedValue({ favorite: true, ignored: false });

    const result = await setStudentQuestionState("student-1", "q1", { favorite: true });

    expect(result).toEqual({
      questionId: "q1",
      levelId: "level-a",
      levelCode: "A",
      favorite: true,
      ignored: false,
    });
    expect(mocks.questionFindFirst).toHaveBeenCalledWith({
      where: { id: "q1", levels: { some: { levelId: "level-a" } } },
      select: { id: true },
    });
    expect(mocks.stateUpsert).toHaveBeenCalledWith({
      where: { userId_levelId_questionId: { userId: "student-1", levelId: "level-a", questionId: "q1" } },
      update: { favorite: true },
      create: { userId: "student-1", levelId: "level-a", questionId: "q1", favorite: true },
      select: { favorite: true, ignored: true },
    });
  });

  it("cancels favorite without touching ignored", async () => {
    mocks.stateUpsert.mockResolvedValue({ favorite: false, ignored: true });

    const result = await setStudentQuestionState("student-1", "q1", { favorite: false });

    expect(result.favorite).toBe(false);
    expect(result.ignored).toBe(true);
    expect(mocks.stateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { favorite: false },
        create: expect.objectContaining({ favorite: false }),
      }),
    );
  });

  it("sets ignored without touching favorite", async () => {
    mocks.stateUpsert.mockResolvedValue({ favorite: true, ignored: true });

    const result = await setStudentQuestionState("student-1", "q1", { ignored: true });

    expect(result.favorite).toBe(true);
    expect(result.ignored).toBe(true);
    expect(mocks.stateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { ignored: true },
        create: expect.objectContaining({ ignored: true }),
      }),
    );
  });

  it("cancels ignored without touching favorite", async () => {
    mocks.stateUpsert.mockResolvedValue({ favorite: false, ignored: false });

    const result = await setStudentQuestionState("student-1", "q1", { ignored: false });

    expect(result.favorite).toBe(false);
    expect(result.ignored).toBe(false);
    expect(mocks.stateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { ignored: false },
        create: expect.objectContaining({ ignored: false }),
      }),
    );
  });

  it("can update favorite and ignored together", async () => {
    mocks.stateUpsert.mockResolvedValue({ favorite: true, ignored: true });

    const result = await setStudentQuestionState("student-1", "q1", { favorite: true, ignored: true });

    expect(result).toMatchObject({ favorite: true, ignored: true });
    expect(mocks.stateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { favorite: true, ignored: true },
        create: expect.objectContaining({ favorite: true, ignored: true }),
      }),
    );
  });

  it("rejects an unassigned student", async () => {
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: null, activeLevel: null });

    await expect(setStudentQuestionState("student-1", "q1", { favorite: true })).rejects.toMatchObject({
      status: 403,
      message: "未分配题库，请联系老师",
    });
    expect(mocks.questionFindFirst).not.toHaveBeenCalled();
    expect(mocks.stateUpsert).not.toHaveBeenCalled();
  });

  it("rejects a question that does not belong to the current active level", async () => {
    mocks.questionFindFirst.mockResolvedValue(null);

    await expect(setStudentQuestionState("student-1", "q1", { favorite: true })).rejects.toMatchObject({
      status: 404,
      message: "题目不存在或不属于当前字母类",
    });
    expect(mocks.stateUpsert).not.toHaveBeenCalled();
  });

  it("rejects a request with no favorite or ignored flag", async () => {
    await expect(setStudentQuestionState("student-1", "q1", {})).rejects.toMatchObject({
      status: 400,
      message: "至少提供 favorite 或 ignored 字段",
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.stateUpsert).not.toHaveBeenCalled();
  });
});
