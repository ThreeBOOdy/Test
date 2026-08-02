import { isAnswerCorrect, shuffle } from "./practice-engine";
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
  preserveOptionOrder: boolean;
  options: QuestionOption[];
  correctOptionIds: string[];
  levelCode: string;
  knowledgeName: string;
};

export function createQuestionSnapshot(question: Omit<QuestionSnapshot, "questionId" | "preserveOptionOrder"> & { id: string; preserveOptionOrder?: boolean }, random: () => number = Math.random): QuestionSnapshot {
  const preserveOptionOrder = question.preserveOptionOrder ?? false;
  const sourceOptions = question.options.map((option) => ({ ...option }));
  const labels = sourceOptions.map((option) => option.id);
  const shuffledOptions = preserveOptionOrder ? sourceOptions : shuffle(sourceOptions, random);
  const labelBySourceId = new Map<string, string>();
  const options = shuffledOptions.map((option, index) => {
    const label = labels[index];
    labelBySourceId.set(option.id, label);
    return { ...option, id: label };
  });
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
    preserveOptionOrder,
    options,
    correctOptionIds: question.correctOptionIds.map((id) => labelBySourceId.get(id) ?? id),
    levelCode: question.levelCode,
    knowledgeName: question.knowledgeName,
  };
}

export function toPublicQuestionSnapshot(snapshot: QuestionSnapshot) {
  const { questionId, correctOptionIds: _correctOptionIds, correctOptionCount: _correctOptionCount, selectionSpec: _selectionSpec, ...question } = snapshot;
  void _correctOptionIds;
  void _correctOptionCount;
  void _selectionSpec;
  return { id: questionId, ...question };
}

export function gradeQuestionSnapshot(snapshot: QuestionSnapshot, selectedOptionIds: readonly string[]) {
  return isAnswerCorrect(selectedOptionIds, snapshot.correctOptionIds);
}
