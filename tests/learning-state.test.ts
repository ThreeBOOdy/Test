import { describe, expect, it } from "vitest";
import {
  advanceLearningState,
  applyFsrsRating,
  clearLearningState,
  createInitialState,
  isDue,
  mapAnswerToRating,
} from "@/lib/domain/learning-state";

const NOW = new Date("2026-08-21T00:00:00.000Z");
const LATER = new Date("2026-08-22T00:00:00.000Z");

describe("mapAnswerToRating", () => {
  it("maps wrong answers to Again regardless of favorite/ignored", () => {
    expect(mapAnswerToRating({ isCorrect: false })).toBe("AGAIN");
    expect(mapAnswerToRating({ isCorrect: false, favorite: true })).toBe("AGAIN");
    expect(mapAnswerToRating({ isCorrect: false, ignored: true })).toBe("AGAIN");
  });

  it("maps correct favorite answers to Hard", () => {
    expect(mapAnswerToRating({ isCorrect: true, favorite: true })).toBe("HARD");
    expect(mapAnswerToRating({ isCorrect: true, favorite: true, ignored: true })).toBe("HARD");
  });

  it("maps correct ignored answers to Easy", () => {
    expect(mapAnswerToRating({ isCorrect: true, ignored: true })).toBe("EASY");
  });

  it("maps ordinary correct answers to Good", () => {
    expect(mapAnswerToRating({ isCorrect: true })).toBe("GOOD");
  });
});

describe("createInitialState", () => {
  it("creates a fresh NEW state with empty FSRS/stat fields", () => {
    expect(createInitialState()).toEqual({
      state: "NEW",
      dueAt: null,
      stability: 0,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      intervalDays: 0,
      lastReviewedAt: null,
      favorite: false,
      ignored: false,
      wrongCount: 0,
      correctCount: 0,
      lastResult: null,
    });
  });

  it("accepts favorite/ignored flags", () => {
    expect(createInitialState({ favorite: true, ignored: true })).toMatchObject({
      favorite: true,
      ignored: true,
    });
  });
});

describe("advanceLearningState", () => {
  it("records an ordinary correct answer as Good and graduates to Review", () => {
    const next = advanceLearningState(null, { isCorrect: true, now: NOW });

    expect(next.state).toBe("REVIEW");
    expect(next.reps).toBe(1);
    expect(next.correctCount).toBe(1);
    expect(next.wrongCount).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.lastResult).toBe("CORRECT");
    expect(next.lastReviewedAt).toEqual(NOW);
    expect(next.dueAt?.getTime()).toBe(NOW.getTime() + 24 * 60 * 60 * 1000);
  });

  it("records a first wrong answer as Again and enters Learning", () => {
    const next = advanceLearningState(null, { isCorrect: false, now: NOW });

    expect(next.state).toBe("LEARNING");
    expect(next.reps).toBe(1);
    expect(next.correctCount).toBe(0);
    expect(next.wrongCount).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.intervalDays).toBe(0);
    expect(next.lastResult).toBe("INCORRECT");
    expect(next.dueAt?.getTime()).toBe(NOW.getTime() + 10 * 60 * 1000);
  });

  it("maps a correct favorite answer to Hard", () => {
    const next = advanceLearningState(null, { isCorrect: true, favorite: true, now: NOW });

    expect(next.state).toBe("LEARNING");
    expect(next.reps).toBe(1);
    expect(next.correctCount).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.stability).toBe(0.7);
    expect(next.difficulty).toBe(5.5);
    expect(next.lastResult).toBe("CORRECT");
  });

  it("maps a correct ignored answer to Easy", () => {
    const next = advanceLearningState(null, { isCorrect: true, ignored: true, now: NOW });

    expect(next.state).toBe("REVIEW");
    expect(next.reps).toBe(1);
    expect(next.correctCount).toBe(1);
    expect(next.intervalDays).toBe(2);
    expect(next.stability).toBe(1.5);
    expect(next.difficulty).toBe(3.5);
    expect(next.lastResult).toBe("CORRECT");
  });

  it("moves a previously reviewed card to Relearning and increments lapses on Again", () => {
    const reviewed = advanceLearningState(null, { isCorrect: true, now: NOW });
    const next = advanceLearningState(reviewed, { isCorrect: false, now: LATER });

    expect(next.state).toBe("RELEARNING");
    expect(next.reps).toBe(2);
    expect(next.lapses).toBe(1);
    expect(next.correctCount).toBe(1);
    expect(next.wrongCount).toBe(1);
    expect(next.stability).toBe(0.5);
    expect(next.difficulty).toBe(6.5);
    expect(next.intervalDays).toBe(0);
    expect(next.lastResult).toBe("INCORRECT");
  });

  it("preserves favorite/ignored flags when advancing existing state", () => {
    const reviewed = advanceLearningState(createInitialState({ favorite: true }), {
      isCorrect: true,
      favorite: true,
      now: NOW,
    });
    const next = advanceLearningState(reviewed, { isCorrect: true, favorite: true, now: LATER });

    expect(next.favorite).toBe(true);
    expect(next.ignored).toBe(false);
    expect(next.correctCount).toBe(2);
  });

  it("uses the supplied rating directly in applyFsrsRating", () => {
    const next = applyFsrsRating(null, "GOOD", NOW);

    expect(next.state).toBe("REVIEW");
    expect(next.lastResult).toBe("CORRECT");
    expect(next.intervalDays).toBe(1);
  });
});

describe("clearLearningState", () => {
  it("resets FSRS/stat fields but preserves favorite/ignored", () => {
    const reviewed = {
      ...createInitialState({ favorite: true }),
      state: "REVIEW" as const,
      dueAt: LATER,
      stability: 8,
      difficulty: 7,
      reps: 4,
      lapses: 2,
      intervalDays: 5,
      lastReviewedAt: NOW,
      wrongCount: 3,
      correctCount: 2,
      lastResult: "CORRECT" as const,
    };

    expect(clearLearningState(reviewed)).toEqual({
      state: "NEW",
      dueAt: null,
      stability: 0,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      intervalDays: 0,
      lastReviewedAt: null,
      favorite: true,
      ignored: false,
      wrongCount: 0,
      correctCount: 0,
      lastResult: null,
    });
  });
});

describe("isDue", () => {
  it("returns true only for reviewed cards whose dueAt has passed", () => {
    const state = {
      ...createInitialState(),
      reps: 1,
      dueAt: new Date("2026-08-21T00:00:00.000Z"),
    };

    expect(isDue(state, new Date("2026-08-21T01:00:00.000Z"))).toBe(true);
    expect(isDue(state, new Date("2026-08-20T23:00:00.000Z"))).toBe(false);
  });

  it("returns false for never-reviewed cards", () => {
    expect(isDue(createInitialState(), NOW)).toBe(false);
  });
});
