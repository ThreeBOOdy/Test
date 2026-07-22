import { isAnswerCorrect } from "./practice-engine";
import type { QuestionOption, QuestionType } from "./types";

export type QuestionSnapshot = {
  questionId: string;
  levelId: string;
  knowledgePointId: string;
  sourceBankCode?: string;
  externalQuestionCode?: string;
  stem: string;
  type: QuestionType;
  optionCount: number;
  correctOptionCount: number;
  selectionSpec: string;
  options: QuestionOption[];
  correctOptionIds: string[];
  levelCode: string;
  knowledgeName: string;
};

export function createQuestionSnapshot(question: Omit<QuestionSnapshot, "questionId"> & { id: string }): QuestionSnapshot {
  return {
    questionId: question.id,
    levelId: question.levelId,
    knowledgePointId: question.knowledgePointId,
    sourceBankCode: question.sourceBankCode,
    externalQuestionCode: question.externalQuestionCode,
    stem: question.stem,
    type: question.type,
    optionCount: question.optionCount,
    correctOptionCount: question.correctOptionCount,
    selectionSpec: question.selectionSpec,
    options: question.options.map((option) => ({ ...option })),
    correctOptionIds: [...question.correctOptionIds],
    levelCode: question.levelCode,
    knowledgeName: question.knowledgeName,
  };
}

export function toPublicQuestionSnapshot(snapshot: QuestionSnapshot) {
  const { questionId, correctOptionIds: _correctOptionIds, ...question } = snapshot;
  void _correctOptionIds;
  return { id: questionId, ...question };
}

export function gradeQuestionSnapshot(snapshot: QuestionSnapshot, selectedOptionIds: readonly string[]) {
  return isAnswerCorrect(selectedOptionIds, snapshot.correctOptionIds);
}
