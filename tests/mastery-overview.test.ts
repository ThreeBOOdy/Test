import { describe, expect, it } from "vitest";

import {
  createInitialState,
  summarizeStudentLevelQuestionStates,
  type StudentLevelQuestionState,
} from "@/lib/domain/learning-state";

const NOW = new Date("2026-08-21T00:00:00.000Z");
const PAST = new Date("2026-08-20T00:00:00.000Z");
const FUTURE = new Date("2026-08-22T00:00:00.000Z");

function state(overrides: Partial<StudentLevelQuestionState>): StudentLevelQuestionState {
  return { ...createInitialState(), ...overrides };
}

describe("summarizeStudentLevelQuestionStates", () => {
  it("counts unanswered questions from the total minus answered states", () => {
    const result = summarizeStudentLevelQuestionStates({
      total: 5,
      now: NOW,
      states: [
        state({ reps: 0, state: "NEW" }),
        state({ reps: 1, state: "REVIEW", dueAt: FUTURE, intervalDays: 1 }),
      ],
    });

    expect(result).toEqual({ total: 5, notStarted: 4, learning: 1, due: 0, mastered: 0 });
  });

  it("treats due questions as due even when their interval would indicate mastery", () => {
    const result = summarizeStudentLevelQuestionStates({
      total: 1,
      now: NOW,
      states: [
        state({ reps: 1, state: "REVIEW", dueAt: PAST, intervalDays: 10 }),
      ],
    });

    expect(result).toEqual({ total: 1, notStarted: 0, learning: 0, due: 1, mastered: 0 });
  });

  it("counts REVIEW questions with interval >= 7 days as mastered", () => {
    const result = summarizeStudentLevelQuestionStates({
      total: 1,
      now: NOW,
      states: [
        state({ reps: 1, state: "REVIEW", dueAt: FUTURE, intervalDays: 7 }),
      ],
    });

    expect(result).toEqual({ total: 1, notStarted: 0, learning: 0, due: 0, mastered: 1 });
  });

  it("counts remaining answered questions as learning", () => {
    const result = summarizeStudentLevelQuestionStates({
      total: 3,
      now: NOW,
      states: [
        state({ reps: 1, state: "LEARNING", dueAt: FUTURE, intervalDays: 0 }),
        state({ reps: 1, state: "RELEARNING", dueAt: FUTURE, intervalDays: 1 }),
        state({ reps: 1, state: "REVIEW", dueAt: FUTURE, intervalDays: 6 }),
      ],
    });

    expect(result).toEqual({ total: 3, notStarted: 0, learning: 3, due: 0, mastered: 0 });
  });

  it("keeps buckets mutually exclusive and equal to the total question pool", () => {
    const result = summarizeStudentLevelQuestionStates({
      total: 10,
      now: NOW,
      states: [
        state({ reps: 0, state: "NEW" }),
        state({ reps: 1, state: "LEARNING", dueAt: FUTURE, intervalDays: 1 }),
        state({ reps: 1, state: "REVIEW", dueAt: PAST, intervalDays: 10 }),
        state({ reps: 1, state: "REVIEW", dueAt: FUTURE, intervalDays: 9 }),
        state({ reps: 1, state: "RELEARNING", dueAt: PAST, intervalDays: 0 }),
      ],
    });

    expect(result.notStarted + result.learning + result.due + result.mastered).toBe(result.total);
    expect(result).toMatchObject({ notStarted: 6, learning: 1, due: 2, mastered: 1 });
  });
});
