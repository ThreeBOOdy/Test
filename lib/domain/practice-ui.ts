import type { PublicAnswerResult, PublicQuestion, QuestionType } from "@/lib/domain/types";

export type QuestionUiState = "current" | "correct" | "wrong" | "drafted" | "unanswered";

export function getInitialQuestionIndex(questions: PublicQuestion[], results: Record<string, PublicAnswerResult>) {
  const index = questions.findIndex((question) => !results[question.id]);
  return index === -1 ? 0 : index;
}

export function toggleDraftSelection(current: string[], optionId: string, type: QuestionType, maximum: number) {
  if (type === "SINGLE_CHOICE") return [optionId];
  if (current.includes(optionId)) return current.filter((id) => id !== optionId);
  return current.length >= maximum ? current : [...current, optionId];
}

export function getQuestionUiState({ isCurrent, draftCount, result }: { isCurrent: boolean; draftCount: number; result?: Pick<PublicAnswerResult, "isCorrect"> }): QuestionUiState {
  if (result) return result.isCorrect ? "correct" : "wrong";
  if (isCurrent) return "current";
  return draftCount > 0 ? "drafted" : "unanswered";
}
