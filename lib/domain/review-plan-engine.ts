export type ReviewCardSource = "WRONG_QUESTION" | "WEAK_KNOWLEDGE";

export type ReviewCardDraft = {
  questionId: string;
  knowledgePointId: string | null;
  source: ReviewCardSource;
  priority: number;
};

export type WrongQuestionCandidate = {
  questionId: string;
  knowledgePointId: string;
  wrongCount: number;
  lastWrongAt: Date | string;
};

export type WeakKnowledgeCandidate = {
  knowledgePointId: string;
  answered: number;
  correct: number;
  accuracy: number;
};

export type QuestionCandidate = {
  id: string;
  knowledgePointId: string;
  levelId: string;
};

export type BuildReviewCardsInput = {
  wrongQuestions: WrongQuestionCandidate[];
  weakKnowledgePoints: WeakKnowledgeCandidate[];
  questions: QuestionCandidate[];
  target: number;
  wrongQuestionLimit?: number;
  weakKnowledgeLimit?: number;
  random?: () => number;
};

export const DAILY_REVIEW_TARGET = 10;
export const DEFAULT_WRONG_QUESTION_LIMIT = 5;
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

export function computeExamSprintTarget(input: { totalCandidates: number; daysUntilExam: number; baseTarget?: number }): number {
  const base = input.baseTarget ?? DAILY_REVIEW_TARGET;
  const days = Math.max(1, Math.floor(input.daysUntilExam));
  const fromCandidates = Math.ceil(input.totalCandidates / days);
  return Math.min(EXAM_SPRINT_MAX_TARGET, Math.max(EXAM_SPRINT_MIN_TARGET, Math.max(base, fromCandidates)));
}

export function buildReviewCards(input: BuildReviewCardsInput): ReviewCardDraft[] {
  const random = input.random ?? Math.random;
  const target = Math.max(0, Math.floor(input.target));
  const wrongQuestionLimit = Math.max(0, input.wrongQuestionLimit ?? DEFAULT_WRONG_QUESTION_LIMIT);
  const weakKnowledgeLimit = Math.max(0, input.weakKnowledgeLimit ?? DEFAULT_WEAK_KNOWLEDGE_LIMIT);

  const selectedWrong = [...input.wrongQuestions]
    .sort((left, right) => right.wrongCount - left.wrongCount || timestamp(left.lastWrongAt) - timestamp(right.lastWrongAt))
    .slice(0, Math.min(wrongQuestionLimit, target))
    .map((item) => ({
      questionId: item.questionId,
      knowledgePointId: item.knowledgePointId,
      source: "WRONG_QUESTION" as const,
      priority: 1000 + item.wrongCount,
    }));

  const usedQuestionIds = new Set(selectedWrong.map((item) => item.questionId));
  const cards: ReviewCardDraft[] = [...selectedWrong];

  if (cards.length >= target) return cards;

  const weakPoints = input.weakKnowledgePoints
    .filter((point) => point.answered >= MIN_WEAK_ANSWER_COUNT && point.accuracy < WEAK_ACCURACY_THRESHOLD)
    .sort((left, right) => left.accuracy - right.accuracy || right.answered - left.answered)
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
