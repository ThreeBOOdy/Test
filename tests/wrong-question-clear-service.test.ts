import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  stateUpdateMany: vi.fn(),
  writeAuditLogInTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    studentLevelQuestionState: { updateMany: mocks.stateUpdateMany },
    $transaction: vi.fn((input: ((tx: object) => unknown) | Promise<unknown>[]) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input({
        studentLevelQuestionState: { updateMany: mocks.stateUpdateMany },
      });
    }),
  },
}));
vi.mock("@/lib/server/audit", () => ({
  writeAuditLogInTransaction: mocks.writeAuditLogInTransaction,
}));

import {
  canStudentSelfClearWrongQuestions,
  clearOwnWrongQuestions,
  clearStudentWrongQuestions,
} from "@/lib/server/wrong-question-clear-service";

const activeLevel = { id: "level-a", code: "A", name: "A级", enabled: true };
const activeLevelUser = { activeLevelId: "level-a", activeLevel };

const resetData = {
  state: "NEW",
  dueAt: null,
  stability: 0,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  intervalDays: 0,
  lastReviewedAt: null,
  wrongCount: 0,
  correctCount: 0,
  lastResult: null,
};

describe("wrong question clear service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.userFindUnique.mockResolvedValue(activeLevelUser);
    mocks.stateUpdateMany.mockResolvedValue({ count: 3 });
    mocks.writeAuditLogInTransaction.mockResolvedValue(undefined);
  });

  it("resets every wrongCount>0 state in the active level and writes an audit log", async () => {
    const result = await clearStudentWrongQuestions("teacher-1", "student-1");

    expect(result).toEqual({ cleared: 3, levelId: "level-a", levelCode: "A" });
    expect(mocks.stateUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "student-1",
        levelId: "level-a",
        wrongCount: { gt: 0 },
      },
      data: resetData,
    });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: "teacher-1",
        action: "WRONG_QUESTION_CLEAR",
        targetType: "User",
        targetId: "student-1",
        metadata: { levelId: "level-a", levelCode: "A", cleared: 3 },
      }),
    );
  });

  it("returns zero when there are no wrong states", async () => {
    mocks.stateUpdateMany.mockResolvedValue({ count: 0 });

    const result = await clearStudentWrongQuestions("teacher-1", "student-1");

    expect(result).toEqual({ cleared: 0, levelId: "level-a", levelCode: "A" });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: expect.objectContaining({ cleared: 0 }) }),
    );
  });

  it("rejects an unassigned student", async () => {
    mocks.userFindUnique.mockResolvedValue({ activeLevelId: null, activeLevel: null });

    await expect(clearStudentWrongQuestions("teacher-1", "student-1")).rejects.toMatchObject({
      status: 403,
      message: "未分配题库，请联系老师",
    });
    expect(mocks.stateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLogInTransaction).not.toHaveBeenCalled();
  });

  it("lets a student clear their own wrong questions only when the grade setting is enabled", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce({ grade: { studentSelfWrongClearEnabled: true } })
      .mockResolvedValueOnce(activeLevelUser);

    const result = await clearOwnWrongQuestions("student-1");

    expect(result).toEqual({ cleared: 3, levelId: "level-a", levelCode: "A" });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: "student-1",
        targetId: "student-1",
        action: "WRONG_QUESTION_CLEAR",
      }),
    );
  });

  it("blocks student self-clearing when the grade has not enabled it", async () => {
    mocks.userFindUnique.mockResolvedValue({ grade: { studentSelfWrongClearEnabled: false } });

    await expect(clearOwnWrongQuestions("student-1")).rejects.toMatchObject({
      status: 403,
      message: "当前未开放学生自助清除错题，请联系老师",
    });
    expect(mocks.stateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLogInTransaction).not.toHaveBeenCalled();
  });

  it("reports the grade self-clear capability", async () => {
    mocks.userFindUnique.mockResolvedValue({ grade: { studentSelfWrongClearEnabled: true } });
    await expect(canStudentSelfClearWrongQuestions("student-1")).resolves.toBe(true);

    mocks.userFindUnique.mockResolvedValue({ grade: { studentSelfWrongClearEnabled: false } });
    await expect(canStudentSelfClearWrongQuestions("student-1")).resolves.toBe(false);

    mocks.userFindUnique.mockResolvedValue({ grade: null });
    await expect(canStudentSelfClearWrongQuestions("student-1")).resolves.toBe(false);
  });
});
