import { describe, expect, it } from "vitest";
import { InsufficientQuestionError, isAnswerCorrect, selectPracticeQuestions, selectPrioritizedRandomQuestions, sortQuestionsByBankNumber } from "../lib/domain/practice-engine";
import type { Question } from "../lib/domain/types";

function question(id: string, type: Question["type"], levelId = "A", knowledgePointId = "kp-1"): Question {
  return { id, type, levelIds: [levelId], knowledgePointId, stem: id, optionCount: 4, correctOptionCount: type === "SINGLE_CHOICE" ? 1 : 2, selectionSpec: type === "SINGLE_CHOICE" ? "4选1" : "4选2", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }, { id: "D", text: "D" }], correctOptionIds: type === "SINGLE_CHOICE" ? ["A"] : ["A", "C"], status: "ACTIVE" };
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

  it("supports dynamic letter-class codes such as K", () => {
    const kBank = [
      ...Array.from({ length: 3 }, (_, index) => question(`k-s-${index}`, "SINGLE_CHOICE", "K")),
      ...Array.from({ length: 2 }, (_, index) => question(`k-m-${index}`, "MULTIPLE_CHOICE", "K")),
    ];
    const result = selectPracticeQuestions(kBank, { mode: "LEVEL_COMPREHENSIVE", levelId: "K", rule: { singleCount: 3, multipleCount: 2 } }, () => 0.5);
    expect(result.questions).toHaveLength(5);
    expect(result.questions.every((item) => item.levelIds.includes("K"))).toBe(true);
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

  it("sorts bank question numbers naturally in ascending order", () => {
    const questions = [
      { ...question("fallback", "SINGLE_CHOICE"), externalQuestionCode: undefined },
      { ...question("q-10", "SINGLE_CHOICE"), externalQuestionCode: "A10" },
      { ...question("q-2", "SINGLE_CHOICE"), externalQuestionCode: "A2" },
      { ...question("q-1", "SINGLE_CHOICE"), externalQuestionCode: "A1" },
    ];

    expect(sortQuestionsByBankNumber(questions).map((item) => item.id)).toEqual(["q-1", "q-2", "q-10", "fallback"]);
  });

  it("fills random practice from unanswered questions before answered ones", () => {
    const questions = Array.from({ length: 6 }, (_, index) => question(`q-${index + 1}`, "SINGLE_CHOICE"));
    const result = selectPrioritizedRandomQuestions(questions, new Set(["q-1", "q-2", "q-3"]), 4, () => 0.42);

    expect(result).toHaveLength(4);
    expect(result.filter((item) => !["q-1", "q-2", "q-3"].includes(item.id))).toHaveLength(3);
  });
});
