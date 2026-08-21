import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  questionCount: vi.fn(),
  stateFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    question: { count: mocks.questionCount },
    studentLevelQuestionState: { findMany: mocks.stateFindMany },
  },
}));

import { getStudentMasteryOverview } from "@/lib/server/student-mastery-overview-service";

const activeLevel = { id: "level-a", code: "A", name: "A级", enabled: true };
const DAY_MS = 24 * 60 * 60 * 1000;
const PAST = new Date(Date.now() - DAY_MS);
const FUTURE = new Date(Date.now() + DAY_MS);

describe("getStudentMasteryOverview", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: "level-a", activeLevel });
    mocks.questionCount.mockResolvedValue(10);
    mocks.stateFindMany.mockResolvedValue([
      { reps: 0, state: "NEW", dueAt: null, intervalDays: 0 },
      { reps: 1, state: "REVIEW", dueAt: FUTURE, intervalDays: 7 },
      { reps: 1, state: "REVIEW", dueAt: PAST, intervalDays: 10 },
      { reps: 1, state: "LEARNING", dueAt: FUTURE, intervalDays: 1 },
    ]);
  });

  it("returns mastery counts scoped to the student's active level", async () => {
    const result = await getStudentMasteryOverview("student-1");

    expect(result).toEqual({
      levelId: "level-a",
      levelCode: "A",
      levelName: "A级",
      total: 10,
      notStarted: 7,
      learning: 1,
      due: 1,
      mastered: 1,
    });
    expect(mocks.questionCount).toHaveBeenCalledWith({
      where: { status: "ACTIVE", levels: { some: { levelId: "level-a" } } },
    });
    expect(mocks.stateFindMany).toHaveBeenCalledWith({
      where: { userId: "student-1", levelId: "level-a", question: { status: "ACTIVE" } },
      select: { reps: true, state: true, dueAt: true, intervalDays: true },
    });
  });

  it("rejects an unassigned student without querying question state", async () => {
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: null, activeLevel: null });

    await expect(getStudentMasteryOverview("student-1")).rejects.toMatchObject({
      status: 403,
      message: "未分配题库，请联系老师",
    });
    expect(mocks.questionCount).not.toHaveBeenCalled();
    expect(mocks.stateFindMany).not.toHaveBeenCalled();
  });
});
