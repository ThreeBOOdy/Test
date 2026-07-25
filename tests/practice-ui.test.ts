import { describe, expect, it } from "vitest";
import { getInitialQuestionIndex, getQuestionUiState, toggleDraftSelection } from "@/lib/domain/practice-ui";
import { buildPracticeLaunchHref, normalizePracticeLaunch } from "@/lib/domain/practice-launcher";
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
    expect(toggleDraftSelection(["A"], "B", "SINGLE_CHOICE")).toEqual(["B"]);
    expect(toggleDraftSelection(["A"], "B", "MULTIPLE_CHOICE")).toEqual(["A", "B"]);
    expect(toggleDraftSelection(["A", "B"], "C", "MULTIPLE_CHOICE")).toEqual(["A", "B", "C"]);
    expect(toggleDraftSelection(["A", "B"], "A", "MULTIPLE_CHOICE")).toEqual(["B"]);
  });
  it("describes navigator states", () => {
    expect(getQuestionUiState({ isCurrent: false, draftCount: 0, result: { isCorrect: true } })).toBe("correct");
    expect(getQuestionUiState({ isCurrent: false, draftCount: 0, result: { isCorrect: false } })).toBe("wrong");
    expect(getQuestionUiState({ isCurrent: false, draftCount: 1 })).toBe("drafted");
    expect(getQuestionUiState({ isCurrent: true, draftCount: 0 })).toBe("current");
    expect(getQuestionUiState({ isCurrent: false, draftCount: 0 })).toBe("unanswered");
  });

  it("builds one canonical launch URL for every practice mode", () => {
    expect(buildPracticeLaunchHref({ mode: "KNOWLEDGE_POINT", levelCode: "A", knowledgePointId: "kp-2" })).toBe("/student/practice/start?mode=knowledge&level=A&knowledge=kp-2");
    expect(buildPracticeLaunchHref({ mode: "MOCK_EXAM", levelCode: "B" })).toBe("/student/practice/start?mode=exam&level=B");
  });

  it("normalizes legacy launcher params into a server request", () => {
    expect(normalizePracticeLaunch({ mode: "random", level: "C" })).toEqual({ mode: "RANDOM_ALL", levelCode: "C" });
    expect(normalizePracticeLaunch({ mode: "knowledge", level: "A", knowledge: "kp-1" })).toEqual({ mode: "KNOWLEDGE_POINT", levelCode: "A", knowledgePointId: "kp-1" });
  });
});
