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

export function selectPracticeQuestions(
  questions: readonly Question[],
  input: CreatePracticeInput,
  random: () => number = Math.random,
): PracticeSelection {
  const knowledgeSet = new Set(input.knowledgePointIds ?? []);
  const eligible = questions.filter((question) => {
    if (question.status !== "ACTIVE") return false;
    if (input.mode !== "WRONG_QUESTION" && question.levelId !== input.levelId) return false;
    if (input.mode === "KNOWLEDGE_POINT" && !knowledgeSet.has(question.knowledgePointId)) return false;
    return true;
  });

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
