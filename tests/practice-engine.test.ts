import { describe, expect, it } from "vitest";
import { InsufficientQuestionError, isAnswerCorrect, selectPracticeQuestions } from "../lib/domain/practice-engine";
import type { Question } from "../lib/domain/types";

function question(id: string, type: Question["type"], levelId = "A", knowledgePointId = "kp-1"): Question {
  return { id, type, levelId, knowledgePointId, stem: id, optionCount: 4, correctOptionCount: type === "SINGLE_CHOICE" ? 1 : 2, selectionSpec: type === "SINGLE_CHOICE" ? "4选1" : "4选2", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }, { id: "D", text: "D" }], correctOptionIds: type === "SINGLE_CHOICE" ? ["A"] : ["A", "C"], status: "ACTIVE" };
}

const bank = [
  ...Array.from({ length: 8 }, (_, index) => question(`s-${index}`, "SINGLE_CHOICE")),
  ...Array.from({ length: 6 }, (_, index) => question(`m-${index}`, "MULTIPLE_CHOICE")),
  question("other-level", "SINGLE_CHOICE", "B"),
  question("other-point", "MULTIPLE_CHOICE", "A", "kp-2"),
];

describe("practice engine", () => {
  it("selects exact counts without duplicates", () => {
    const result = selectPracticeQuestions(bank, { mode: "LEVEL_COMPREHENSIVE", levelId: "A", rule: { singleCount: 4, multipleCount: 3 } }, () => 0.42);
    expect(result.singleCount).toBe(4);
    expect(result.multipleCount).toBe(3);
    expect(new Set(result.questions.map((item) => item.id)).size).toBe(7);
  });

  it("limits knowledge practice to selected descendants", () => {
    const result = selectPracticeQuestions(bank, { mode: "KNOWLEDGE_POINT", levelId: "A", knowledgePointIds: ["kp-1"], rule: { singleCount: 2, multipleCount: 2 } }, () => 0.25);
    expect(result.questions.every((item) => item.knowledgePointId === "kp-1")).toBe(true);
  });

  it("fails instead of silently lowering requested counts", () => {
    expect(() => selectPracticeQuestions(bank, { mode: "LEVEL_COMPREHENSIVE", levelId: "A", rule: { singleCount: 99, multipleCount: 0 } })).toThrow(InsufficientQuestionError);
  });

  it("scores multiple choice as an exact set", () => {
    expect(isAnswerCorrect(["C", "A"], ["A", "C"])).toBe(true);
    expect(isAnswerCorrect(["A"], ["A", "C"])).toBe(false);
    expect(isAnswerCorrect(["A", "B"], ["A", "C"])).toBe(false);
  });

  it("selects at most twenty pending wrong questions", () => {
    const wrongBank = Array.from({ length: 25 }, (_, index) => question(`wrong-${index}`, "SINGLE_CHOICE", index % 2 ? "A" : "B"));
    const result = selectPracticeQuestions(wrongBank, {
      mode: "WRONG_QUESTION",
      levelId: "",
      rule: { singleCount: 20, multipleCount: 0 },
    }, () => 0.42);
    expect(result.questions).toHaveLength(20);
    expect(new Set(result.questions.map((item) => item.id)).size).toBe(20);
  });
});
