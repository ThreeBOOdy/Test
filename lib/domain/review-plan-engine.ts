export type ReviewCardSource = "WRONG_QUESTION" | "WEAK_KNOWLEDGE";

export type ReviewCardDraft = {
  questionId: string;
  knowledgePointId: string | null;
  source: ReviewCardSource;
  priority: number;
};

export type FsrsDueQuestionCandidate = {
  questionId: string;
  knowledgePointId: string;
  dueAt: Date | string;
  difficulty: number;
  stability: number;
  lapses: number;
  wrongCount: number;
  favorite: boolean;
  ignored: boolean;
  lastReviewedAt: Date | string | null;
};

export type WeakKnowledgeCandidate = {
  knowledgePointId: string;
  answered: number;
  correct: number;
  accuracy: number;
  maxDifficulty?: number;
  totalLapses?: number;
};

export type QuestionCandidate = {
  id: string;
  knowledgePointId: string;
};

export type BuildReviewCardsInput = {
  dueQuestions: FsrsDueQuestionCandidate[];
  weakKnowledgePoints: WeakKnowledgeCandidate[];
  questions: QuestionCandidate[];
  target: number;
  dueQuestionLimit?: number;
  weakKnowledgeLimit?: number;
  random?: () => number;
};

export const DAILY_REVIEW_TARGET = 10;
export const DEFAULT_DUE_QUESTION_LIMIT = 5;
export const DEFAULT_WRONG_QUESTION_LIMIT = DEFAULT_DUE_QUESTION_LIMIT;
export const DEFAULT_WEAK_KNOWLEDGE_LIMIT = 5;
export const MIN_WEAK_ANSWER_COUNT = 3;
export const WEAK_ACCURACY_THRESHOLD = 80;
export const EXAM_SPRINT_MIN_TARGET = 5;
export const EXAM_SPRINT_MAX_TARGET = 30;

function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function timestamp(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareDue(
  left: FsrsDueQuestionCandidate,
  right: FsrsDueQuestionCandidate,
): number {
  if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
  const leftDue = timestamp(left.dueAt);
  const rightDue = timestamp(right.dueAt);
  if (leftDue !== rightDue) return leftDue - rightDue;
  if (left.wrongCount !== right.wrongCount) return right.wrongCount - left.wrongCount;
  if (left.difficulty !== right.difficulty) return right.difficulty - left.difficulty;
  return Number(left.ignored) - Number(right.ignored);
}

function duePriority(item: FsrsDueQuestionCandidate): number {
  const difficultyBoost = Math.max(0, Math.round((item.difficulty - 5) * 100));
  const lapseBoost = item.lapses * 20;
  const wrongBoost = Math.min(999, item.wrongCount * 10);
  return 2000 + difficultyBoost + lapseBoost + wrongBoost;
}

export function computeExamSprintTarget(input: { totalCandidates: number; daysUntilExam: number; baseTarget?: number }): number {
  const base = input.baseTarget ?? DAILY_REVIEW_TARGET;
  const days = Math.max(1, Math.floor(input.daysUntilExam));
  const fromCandidates = Math.ceil(input.totalCandidates / days);
  return Math.min(EXAM_SPRINT_MAX_TARGET, Math.max(EXAM_SPRINT_MIN_TARGET, Math.max(base, fromCandidates)));
}

export function buildReviewCards(input: BuildReviewCardsInput): ReviewCardDraft[] {
  const random = input.random ?? Math.random;
  const target = Math.max(0, Math.floor(input.target));
  const dueQuestionLimit = Math.max(0, input.dueQuestionLimit ?? DEFAULT_DUE_QUESTION_LIMIT);
  const weakKnowledgeLimit = Math.max(0, input.weakKnowledgeLimit ?? DEFAULT_WEAK_KNOWLEDGE_LIMIT);

  const selectedDue = [...input.dueQuestions]
    .sort(compareDue)
    .slice(0, Math.min(dueQuestionLimit, target))
    .map((item) => ({
      questionId: item.questionId,
      knowledgePointId: item.knowledgePointId,
      source: "WRONG_QUESTION" as const,
      priority: duePriority(item),
    }));

  const usedQuestionIds = new Set(selectedDue.map((item) => item.questionId));
  const cards: ReviewCardDraft[] = [...selectedDue];

  if (cards.length >= target) return cards;

  const weakPoints = input.weakKnowledgePoints
    .filter((point) => point.answered >= MIN_WEAK_ANSWER_COUNT && point.accuracy < WEAK_ACCURACY_THRESHOLD)
    .sort(
      (left, right) =>
        left.accuracy - right.accuracy ||
        right.answered - left.answered ||
        (right.maxDifficulty ?? 0) - (left.maxDifficulty ?? 0),
    )
    .slice(0, weakKnowledgeLimit);

  const pools = weakPoints
    .map((point) => ({
      point,
      pool: shuffle(input.questions.filter((question) => question.knowledgePointId === point.knowledgePointId && !usedQuestionIds.has(question.id)), random),
    }))
    .filter((entry) => entry.pool.length > 0);

  let cursor = 0;
  while (cards.length < target && pools.some((entry) => entry.pool.length > 0)) {
    const entry = pools[cursor % pools.length];
    const question = entry.pool.shift();
    if (question) {
      cards.push({
        questionId: question.id,
        knowledgePointId: entry.point.knowledgePointId,
        source: "WEAK_KNOWLEDGE",
        priority: Math.max(1, 100 - entry.point.accuracy),
      });
      usedQuestionIds.add(question.id);
    }
    cursor += 1;
  }

  return cards;
}
