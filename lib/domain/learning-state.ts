export type LearningState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";

export type AnswerResult = "CORRECT" | "INCORRECT";

export type FsrsRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export type StudentLevelQuestionState = {
  state: LearningState;
  dueAt: Date | null;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  intervalDays: number;
  lastReviewedAt: Date | null;
  favorite: boolean;
  ignored: boolean;
  wrongCount: number;
  correctCount: number;
  lastResult: AnswerResult | null;
};

export type AnswerOutcome = "CORRECT" | "WRONG";

export type AnswerInput = {
  isCorrect: boolean;
  favorite?: boolean;
  ignored?: boolean;
  now?: Date;
};

export const INITIAL_DIFFICULTY = 5;
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;
export const INITIAL_STABILITY = 1;
export const MIN_STABILITY = 0.1;
export const AGAIN_DUE_MINUTES = 10;

export function createInitialState(input: { favorite?: boolean; ignored?: boolean } = {}): StudentLevelQuestionState {
  return {
    state: "NEW",
    dueAt: null,
    stability: 0,
    difficulty: INITIAL_DIFFICULTY,
    reps: 0,
    lapses: 0,
    intervalDays: 0,
    lastReviewedAt: null,
    favorite: input.favorite ?? false,
    ignored: input.ignored ?? false,
    wrongCount: 0,
    correctCount: 0,
    lastResult: null,
  };
}

export function mapAnswerToRating(input: { isCorrect: boolean; favorite?: boolean; ignored?: boolean }): FsrsRating {
  if (!input.isCorrect) return "AGAIN";
  if (input.favorite) return "HARD";
  if (input.ignored) return "EASY";
  return "GOOD";
}

function clampDifficulty(value: number): number {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, value));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function nextStability(previous: StudentLevelQuestionState | null, rating: FsrsRating): number {
  if (!previous || previous.reps === 0) {
    switch (rating) {
      case "AGAIN":
        return 0.3;
      case "HARD":
        return 0.7;
      case "GOOD":
        return INITIAL_STABILITY;
      case "EASY":
        return 1.5;
    }
  }

  switch (rating) {
    case "AGAIN":
      return Math.max(MIN_STABILITY, previous.stability * 0.5);
    case "HARD":
      return previous.stability * 1.2;
    case "GOOD":
      return previous.stability * 2.5;
    case "EASY":
      return previous.stability * 3.5;
  }
}

function nextDifficulty(previous: StudentLevelQuestionState | null, rating: FsrsRating): number {
  const current = previous?.difficulty ?? INITIAL_DIFFICULTY;
  switch (rating) {
    case "AGAIN":
      return clampDifficulty(current + 2);
    case "HARD":
      return clampDifficulty(current + 0.5);
    case "GOOD":
      return clampDifficulty(current - 0.5);
    case "EASY":
      return clampDifficulty(current - 1.5);
  }
}

function nextIntervalDays(previous: StudentLevelQuestionState | null, stability: number, rating: FsrsRating): number {
  if (rating === "AGAIN") return 0;
  return Math.max(1, Math.round(stability));
}

function nextState(previous: StudentLevelQuestionState | null, rating: FsrsRating): LearningState {
  if (!previous || previous.reps === 0) {
    return rating === "AGAIN" || rating === "HARD" ? "LEARNING" : "REVIEW";
  }
  if (rating === "AGAIN") return "RELEARNING";
  return "REVIEW";
}

export function applyFsrsRating(
  previous: StudentLevelQuestionState | null,
  rating: FsrsRating,
  now: Date = new Date(),
): StudentLevelQuestionState {
  const base = previous ?? createInitialState();
  const stability = nextStability(previous, rating);
  const difficulty = nextDifficulty(previous, rating);
  const intervalDays = nextIntervalDays(previous, stability, rating);
  const state = nextState(previous, rating);
  const isCorrect = rating !== "AGAIN";
  const lapses = previous && previous.reps > 0 && rating === "AGAIN" ? previous.lapses + 1 : (base.lapses ?? 0);

  return {
    ...base,
    state,
    dueAt: rating === "AGAIN" ? addMinutes(now, AGAIN_DUE_MINUTES) : addDays(now, intervalDays),
    stability,
    difficulty,
    reps: base.reps + 1,
    lapses,
    intervalDays,
    lastReviewedAt: new Date(now.getTime()),
    wrongCount: base.wrongCount + (isCorrect ? 0 : 1),
    correctCount: base.correctCount + (isCorrect ? 1 : 0),
    lastResult: isCorrect ? "CORRECT" : "INCORRECT",
  };
}

export function advanceLearningState(
  previous: StudentLevelQuestionState | null,
  input: AnswerInput,
): StudentLevelQuestionState {
  const rating = mapAnswerToRating(input);
  return applyFsrsRating(previous, rating, input.now ?? new Date());
}

export function clearLearningState(state: StudentLevelQuestionState): StudentLevelQuestionState {
  return {
    ...createInitialState({ favorite: state.favorite, ignored: state.ignored }),
    state: "NEW",
  };
}

export function isDue(state: StudentLevelQuestionState, now: Date = new Date()): boolean {
  return state.reps > 0 && state.dueAt !== null && state.dueAt.getTime() <= now.getTime();
}
