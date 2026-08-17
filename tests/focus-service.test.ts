import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  focusFindFirst: vi.fn(),
  focusFindMany: vi.fn(),
  focusCreate: vi.fn(),
  focusUpdate: vi.fn(),
  practiceFindMany: vi.fn(),
  reviewFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    focusSession: {
      findFirst: mocks.focusFindFirst,
      findMany: mocks.focusFindMany,
      create: mocks.focusCreate,
      update: mocks.focusUpdate,
    },
    practiceSession: {
      findMany: mocks.practiceFindMany,
    },
    reviewPlan: {
      findMany: mocks.reviewFindMany,
    },
  },
}));

import {
  calculateStudyStreak,
  completeFocusSession,
  getFocusOverview,
  shiftDateString,
  startFocusSession,
} from "@/lib/server/focus-service";

const baseSession = {
  id: "focus-1",
  status: "IN_PROGRESS",
  targetMinutes: 25,
  targetQuestionCount: null,
  actualMinutes: null,
  actualQuestionCount: null,
  startedAt: new Date("2026-08-17T01:00:00.000Z"),
  endedAt: null,
};

describe("calculateStudyStreak", () => {
  it("returns 0 when no recent days are checked in", () => {
    expect(calculateStudyStreak(new Set(["2026-08-10"]), "2026-08-17")).toBe(0);
  });

  it("counts today when checked in", () => {
    expect(calculateStudyStreak(new Set(["2026-08-17", "2026-08-16"]), "2026-08-17")).toBe(2);
  });

  it("keeps the streak through yesterday when today is not yet checked in", () => {
    expect(calculateStudyStreak(new Set(["2026-08-16", "2026-08-15"]), "2026-08-17")).toBe(2);
  });

  it("breaks the streak after a missing day", () => {
    expect(calculateStudyStreak(new Set(["2026-08-17", "2026-08-15", "2026-08-14"]), "2026-08-17")).toBe(1);
  });

  it("handles month boundaries", () => {
    expect(shiftDateString("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDateString("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("startFocusSession", () => {
  beforeEach(() => {
    mocks.focusFindFirst.mockReset();
    mocks.focusCreate.mockReset();
    mocks.focusFindFirst.mockResolvedValue(null);
    mocks.focusCreate.mockResolvedValue({ ...baseSession, id: "focus-new", targetMinutes: 30 });
  });

  it("creates a focus session with a target duration", async () => {
    const result = await startFocusSession("user-1", { targetMinutes: 30 });

    expect(result).toMatchObject({ id: "focus-new", status: "IN_PROGRESS", targetMinutes: 30 });
    expect(mocks.focusCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", targetMinutes: 30, targetQuestionCount: null },
    });
  });

  it("creates a focus session with a target question count", async () => {
    await startFocusSession("user-1", { targetQuestionCount: 20 });
    expect(mocks.focusCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", targetMinutes: null, targetQuestionCount: 20 },
    });
  });

  it("rejects when no target is provided", async () => {
    await expect(startFocusSession("user-1", {})).rejects.toMatchObject({ status: 400 });
    expect(mocks.focusCreate).not.toHaveBeenCalled();
  });

  it("rejects an existing active session", async () => {
    mocks.focusFindFirst.mockResolvedValue(baseSession);
    await expect(startFocusSession("user-1", { targetMinutes: 25 })).rejects.toMatchObject({ status: 409 });
    expect(mocks.focusCreate).not.toHaveBeenCalled();
  });

  it("rejects non-positive targets", async () => {
    await expect(startFocusSession("user-1", { targetMinutes: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(startFocusSession("user-1", { targetQuestionCount: -1 })).rejects.toMatchObject({ status: 400 });
    expect(mocks.focusCreate).not.toHaveBeenCalled();
  });
});

describe("completeFocusSession", () => {
  beforeEach(() => {
    mocks.focusFindFirst.mockReset();
    mocks.focusUpdate.mockReset();
    mocks.focusFindFirst.mockResolvedValue(baseSession);
    mocks.focusUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...baseSession,
      ...args.data,
      endedAt: args.data.endedAt as Date,
    }));
  });

  it("completes a duration-based session after the target is reached", async () => {
    const startedAt = new Date(Date.now() - 30 * 60_000);
    mocks.focusFindFirst.mockResolvedValue({ ...baseSession, startedAt });

    const result = await completeFocusSession("user-1", "focus-1", { completed: true });

    expect(result.status).toBe("COMPLETED");
    expect(result.actualMinutes).toBeGreaterThanOrEqual(25);
    expect(mocks.focusUpdate).toHaveBeenCalledWith({
      where: { id: "focus-1" },
      data: expect.objectContaining({ status: "COMPLETED", endedAt: expect.any(Date) }),
    });
  });

  it("rejects completing before the duration target is reached", async () => {
    const startedAt = new Date(Date.now() - 10 * 60_000);
    mocks.focusFindFirst.mockResolvedValue({ ...baseSession, startedAt });

    await expect(completeFocusSession("user-1", "focus-1", { completed: true })).rejects.toMatchObject({ status: 409 });
    expect(mocks.focusUpdate).not.toHaveBeenCalled();
  });

  it("completes a question-based session with a reported question count", async () => {
    const startedAt = new Date(Date.now() - 5 * 60_000);
    mocks.focusFindFirst.mockResolvedValue({ ...baseSession, targetMinutes: null, targetQuestionCount: 20, startedAt });

    const result = await completeFocusSession("user-1", "focus-1", { completed: true, actualQuestionCount: 20 });

    expect(result.status).toBe("COMPLETED");
    expect(result.actualQuestionCount).toBe(20);
  });

  it("requires a question count for question-based completion", async () => {
    mocks.focusFindFirst.mockResolvedValue({ ...baseSession, targetMinutes: null, targetQuestionCount: 20 });
    await expect(completeFocusSession("user-1", "focus-1", { completed: true })).rejects.toMatchObject({ status: 400 });
  });

  it("abandons without breaking the streak when completed is false", async () => {
    const result = await completeFocusSession("user-1", "focus-1", { completed: false });
    expect(result.status).toBe("ABANDONED");
    expect(mocks.focusUpdate).toHaveBeenCalledWith({
      where: { id: "focus-1" },
      data: expect.objectContaining({ status: "ABANDONED", actualQuestionCount: null }),
    });
  });

  it("rejects ending a session that is already finished", async () => {
    mocks.focusFindFirst.mockResolvedValue({ ...baseSession, status: "COMPLETED", endedAt: new Date() });
    await expect(completeFocusSession("user-1", "focus-1", { completed: false })).rejects.toMatchObject({ status: 409 });
    expect(mocks.focusUpdate).not.toHaveBeenCalled();
  });
});

describe("getFocusOverview", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  beforeEach(() => {
    mocks.focusFindFirst.mockReset();
    mocks.focusFindMany.mockReset();
    mocks.focusCreate.mockReset();
    mocks.focusUpdate.mockReset();
    mocks.practiceFindMany.mockReset();
    mocks.reviewFindMany.mockReset();
    mocks.focusFindFirst.mockResolvedValue(null);
    mocks.focusFindMany.mockResolvedValue([]);
    mocks.practiceFindMany.mockResolvedValue([]);
    mocks.reviewFindMany.mockResolvedValue([]);
  });

  it("returns streak, today check-in, focus minutes and active session", async () => {
    mocks.focusFindFirst.mockResolvedValue({ ...baseSession, id: "active-1" });
    mocks.practiceFindMany.mockResolvedValue([
      { startedAt: new Date("2026-08-17T02:00:00.000Z") },
      { startedAt: new Date("2026-08-16T02:00:00.000Z") },
    ]);
    mocks.reviewFindMany.mockResolvedValue([
      { completedAt: new Date("2026-08-15T02:00:00.000Z") },
    ]);
    mocks.focusFindMany.mockResolvedValue([
      { startedAt: new Date("2026-08-17T03:00:00.000Z"), actualMinutes: 25 },
      { startedAt: new Date("2026-08-16T03:00:00.000Z"), actualMinutes: 30 },
    ]);

    const result = await getFocusOverview("user-1", now, "UTC");

    expect(result).toEqual({
      currentStreak: 3,
      todayCheckedIn: true,
      todayFocusMinutes: 25,
      activeFocusSession: expect.objectContaining({ id: "active-1" }),
    });
  });

  it("keeps yesterday streak when today is not checked in yet", async () => {
    mocks.practiceFindMany.mockResolvedValue([
      { startedAt: new Date("2026-08-16T02:00:00.000Z") },
      { startedAt: new Date("2026-08-15T02:00:00.000Z") },
    ]);

    const result = await getFocusOverview("user-1", now, "UTC");

    expect(result.currentStreak).toBe(2);
    expect(result.todayCheckedIn).toBe(false);
    expect(result.todayFocusMinutes).toBe(0);
  });
});
