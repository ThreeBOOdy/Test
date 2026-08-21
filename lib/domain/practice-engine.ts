import type { PracticeMode, PracticeRule, Question } from "@/lib/domain/types";

export type CreatePracticeInput = {
  mode: PracticeMode;
  levelId: string;
  knowledgePointIds?: string[];
  rule: PracticeRule;
};

export type PracticeSelection = {
  questions: Question[];
  singleCount: number;
  multipleCount: number;
};

export class InsufficientQuestionError extends Error {
  constructor(
    public readonly type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`${type === "SINGLE_CHOICE" ? "单选" : "多选"}题不足：需要 ${required} 道，当前 ${available} 道`);
  }
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

const questionNumberCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function sortQuestionsByBankNumber<T extends Pick<Question, "id" | "externalQuestionCode" | "sourceBankCode">>(questions: readonly T[]): T[] {
  return [...questions].sort((left, right) => {
    const leftCode = left.externalQuestionCode?.trim() || left.sourceBankCode?.trim();
    const rightCode = right.externalQuestionCode?.trim() || right.sourceBankCode?.trim();
    if (leftCode && rightCode) return questionNumberCollator.compare(leftCode, rightCode) || left.id.localeCompare(right.id);
    if (leftCode) return -1;
    if (rightCode) return 1;
    return left.id.localeCompare(right.id);
  });
}

export function selectPrioritizedRandomQuestions<T extends Pick<Question, "id">>(questions: readonly T[], answeredQuestionIds: ReadonlySet<string>, count: number, random: () => number = Math.random): T[] {
  const unanswered = questions.filter((question) => !answeredQuestionIds.has(question.id));
  const answered = questions.filter((question) => answeredQuestionIds.has(question.id));
  return [...shuffle(unanswered, random), ...shuffle(answered, random)].slice(0, Math.max(0, count));
}

export type RandomQuestionState = {
  reps: number;
  favorite: boolean;
  ignored: boolean;
  dueAt: Date | null;
  wrongCount: number;
  intervalDays: number;
};

export type RandomQuestionSelectionOptions = {
  /** Per-question FSRS/learning state for the current (user, level). */
  stateByQuestionId?: ReadonlyMap<string, RandomQuestionState>;
  now?: Date;
};

export const RANDOM_STAGE_INTERVAL_DAYS = 7;

function randomStateFor<T extends Pick<Question, "id">>(question: T, options: RandomQuestionSelectionOptions): RandomQuestionState | undefined {
  return options.stateByQuestionId?.get(question.id);
}

function compareRandomReviewPriority(left: { id: string; randomState?: RandomQuestionState }, right: { id: string; randomState?: RandomQuestionState }): number {
  const leftState = left.randomState;
  const rightState = right.randomState;
  if ((leftState?.favorite ?? false) !== (rightState?.favorite ?? false)) return leftState?.favorite ? -1 : 1;
  const leftDue = leftState?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDue = rightState?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;
  if ((leftState?.wrongCount ?? 0) !== (rightState?.wrongCount ?? 0)) return (rightState?.wrongCount ?? 0) - (leftState?.wrongCount ?? 0);
  if ((leftState?.ignored ?? false) !== (rightState?.ignored ?? false)) return leftState?.ignored ? 1 : -1;
  return left.id.localeCompare(right.id);
}

function withRandomState<T extends Pick<Question, "id">>(items: readonly T[], options: RandomQuestionSelectionOptions): Array<T & { randomState?: RandomQuestionState }> {
  return items.map((item) => ({ ...item, randomState: randomStateFor(item, options) }));
}

/**
 * Random practice ordering:
 * 1. Unseen questions first (preserves #11 behavior).
 * 2. Then due cards (dueAt <= now), ordered favorite -> dueAt asc -> wrongCount desc -> ignored last.
 * 3. Then not-due low-mastery (intervalDays < 7) or favorite cards, same priority order.
 * 4. Finally mastered/non-favorite cards, shuffled.
 */
export function selectRandomPracticeQuestions<T extends Pick<Question, "id">>(
  questions: readonly T[],
  answeredQuestionIds: ReadonlySet<string>,
  random: () => number = Math.random,
  options: RandomQuestionSelectionOptions = {},
): T[] {
  if (!options.stateByQuestionId) {
    const unanswered = questions.filter((question) => !answeredQuestionIds.has(question.id));
    const answered = questions.filter((question) => answeredQuestionIds.has(question.id));
    return [...shuffle(unanswered, random), ...shuffle(answered, random)];
  }

  const now = options.now ?? new Date();
  const unseen: Array<T & { randomState?: RandomQuestionState }> = [];
  const due: Array<T & { randomState?: RandomQuestionState }> = [];
  const lowOrFavorite: Array<T & { randomState?: RandomQuestionState }> = [];
  const mastered: Array<T & { randomState?: RandomQuestionState }> = [];

  for (const question of withRandomState(questions, options)) {
    const state = question.randomState;
    if (answeredQuestionIds.has(question.id) && state?.reps && state.reps > 0 && state.dueAt !== null && state.dueAt.getTime() <= now.getTime()) {
      due.push(question);
    } else if (answeredQuestionIds.has(question.id) && state && (state.intervalDays < RANDOM_STAGE_INTERVAL_DAYS || state.favorite)) {
      lowOrFavorite.push(question);
    } else if (answeredQuestionIds.has(question.id) && state && state.reps > 0) {
      mastered.push(question);
    } else {
      unseen.push(question);
    }
  }

  due.sort(compareRandomReviewPriority);
  lowOrFavorite.sort(compareRandomReviewPriority);
  return [...shuffle(unseen, random), ...due, ...lowOrFavorite, ...shuffle(mastered, random)];
}

/**
 * True when every question has been reviewed (reps > 0), has no due card
 * (dueAt is null or in the future), and has reached the long-term interval
 * (intervalDays >= 7).
 */
export function isRandomStageCompleted(
  questions: readonly Pick<Question, "id">[],
  stateByQuestionId: ReadonlyMap<string, RandomQuestionState>,
  now: Date = new Date(),
): boolean {
  if (questions.length === 0) return false;
  return questions.every((question) => {
    const state = stateByQuestionId.get(question.id);
    return state !== undefined
      && state.reps > 0
      && (state.dueAt === null || state.dueAt.getTime() > now.getTime())
      && state.intervalDays >= RANDOM_STAGE_INTERVAL_DAYS;
  });
}

export function selectPracticeQuestions(
  questions: readonly Question[],
  input: CreatePracticeInput,
  random: () => number = Math.random,
): PracticeSelection {
  const knowledgeSet = new Set(input.knowledgePointIds ?? []);
  const eligible = questions.filter((question) => {
    if (question.status !== "ACTIVE") return false;
    if (input.mode !== "WRONG_QUESTION" && !question.levelIds.includes(input.levelId)) return false;
    if (input.mode === "KNOWLEDGE_POINT" && !knowledgeSet.has(question.knowledgePointId)) return false;
    return true;
  });

  if (input.mode === "WRONG_QUESTION") {
    const singles = eligible.filter((question) => question.type === "SINGLE_CHOICE");
    const multiples = eligible.filter((question) => question.type === "MULTIPLE_CHOICE");
    return {
      questions: shuffle(eligible, random),
      singleCount: singles.length,
      multipleCount: multiples.length,
    };
  }

  const singles = eligible.filter((question) => question.type === "SINGLE_CHOICE");
  const multiples = eligible.filter((question) => question.type === "MULTIPLE_CHOICE");

  if (singles.length < input.rule.singleCount) {
    throw new InsufficientQuestionError("SINGLE_CHOICE", input.rule.singleCount, singles.length);
  }
  if (multiples.length < input.rule.multipleCount) {
    throw new InsufficientQuestionError("MULTIPLE_CHOICE", input.rule.multipleCount, multiples.length);
  }

  const selectedSingles = shuffle(singles, random).slice(0, input.rule.singleCount);
  const selectedMultiples = shuffle(multiples, random).slice(0, input.rule.multipleCount);

  return {
    questions: shuffle([...selectedSingles, ...selectedMultiples], random),
    singleCount: selectedSingles.length,
    multipleCount: selectedMultiples.length,
  };
}

export function isAnswerCorrect(selected: readonly string[], correct: readonly string[]): boolean {
  if (selected.length !== correct.length) return false;
  const normalizedSelected = [...selected].sort();
  const normalizedCorrect = [...correct].sort();
  return normalizedSelected.every((value, index) => value === normalizedCorrect[index]);
}
