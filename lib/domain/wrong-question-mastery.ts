export const WRONG_QUESTION_MASTERY_STREAK = 3;

export type WrongQuestionMasteryState = {
  correctSessionCount: number;
  mastered: boolean;
  lastCountedSessionId: string | null;
};

export type WrongQuestionOutcome = "CORRECT" | "WRONG";

export function advanceWrongQuestionMastery(
  state: WrongQuestionMasteryState,
  outcome: WrongQuestionOutcome,
  sessionId: string,
): WrongQuestionMasteryState {
  if (state.lastCountedSessionId === sessionId) return state;
  if (outcome === "WRONG") {
    return { correctSessionCount: 0, mastered: false, lastCountedSessionId: sessionId };
  }
  const correctSessionCount = Math.min(WRONG_QUESTION_MASTERY_STREAK, state.correctSessionCount + 1);
  return { correctSessionCount, mastered: correctSessionCount >= WRONG_QUESTION_MASTERY_STREAK, lastCountedSessionId: sessionId };
}
