import { describe, expect, it } from "vitest";
import { getInitialQuestionIndex, getQuestionUiState, toggleDraftSelection } from "@/lib/domain/practice-ui";
import { practiceSessionFixture } from "@/tests/fixtures/practice-session";

describe("practice UI state", () => {
  it("resumes at the first unanswered question", () => {
    const session = practiceSessionFixture({ initialResults: { "question-1": { isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1 } } });
    expect(getInitialQuestionIndex(session.questions, session.initialResults)).toBe(1);
  });
  it("returns zero when every question is answered", () => {
    const session = practiceSessionFixture();
    const results = Object.fromEntries(session.questions.map((question) => [question.id, { isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 2, correctCount: 2 }]));
    expect(getInitialQuestionIndex(session.questions, results)).toBe(0);
  });
  it("manages single and multiple drafts", () => {
    expect(toggleDraftSelection(["A"], "B", "SINGLE_CHOICE", 1)).toEqual(["B"]);
    expect(toggleDraftSelection(["A"], "B", "MULTIPLE_CHOICE", 2)).toEqual(["A", "B"]);
    expect(toggleDraftSelection(["A", "B"], "C", "MULTIPLE_CHOICE", 2)).toEqual(["A", "B"]);
    expect(toggleDraftSelection(["A", "B"], "A", "MULTIPLE_CHOICE", 2)).toEqual(["B"]);
  });
  it("describes navigator states", () => {
    expect(getQuestionUiState({ isCurrent: false, draftCount: 0, result: { isCorrect: true } })).toBe("correct");
    expect(getQuestionUiState({ isCurrent: false, draftCount: 0, result: { isCorrect: false } })).toBe("wrong");
    expect(getQuestionUiState({ isCurrent: false, draftCount: 1 })).toBe("drafted");
    expect(getQuestionUiState({ isCurrent: true, draftCount: 0 })).toBe("current");
    expect(getQuestionUiState({ isCurrent: false, draftCount: 0 })).toBe("unanswered");
  });
});
