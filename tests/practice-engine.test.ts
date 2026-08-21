import { describe, expect, it } from "vitest";
import { InsufficientQuestionError, isAnswerCorrect, isRandomStageCompleted, selectPracticeQuestions, selectPrioritizedRandomQuestions, selectRandomPracticeQuestions, sortQuestionsByBankNumber, type RandomQuestionState } from "../lib/domain/practice-engine";
import type { Question } from "../lib/domain/types";

function question(id: string, type: Question["type"], levelId = "A", knowledgePointId = "kp-1"): Question {
  return { id, type, levelIds: [levelId], knowledgePointId, stem: id, optionCount: 4, correctOptionCount: type === "SINGLE_CHOICE" ? 1 : 2, selectionSpec: type === "SINGLE_CHOICE" ? "4选1" : "4选2", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }, { id: "D", text: "D" }], correctOptionIds: type === "SINGLE_CHOICE" ? ["A"] : ["A", "C"], status: "ACTIVE" };
}

function randomState(overrides: Partial<RandomQuestionState> = {}): RandomQuestionState {
  return { reps: 1, favorite: false, ignored: false, dueAt: null, wrongCount: 0, intervalDays: 0, ...overrides };
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

  it("includes all pending wrong questions without a fixed cap", () => {
    const wrongBank = Array.from({ length: 25 }, (_, index) => question(`wrong-${index}`, "SINGLE_CHOICE", index % 2 ? "A" : "B"));
    const result = selectPracticeQuestions(wrongBank, {
      mode: "WRONG_QUESTION",
      levelId: "",
      rule: { singleCount: 20, multipleCount: 0 },
    }, () => 0.42);
    expect(result.questions).toHaveLength(25);
    expect(new Set(result.questions.map((item) => item.id)).size).toBe(25);
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

  it("selects every active random question without a quantity limit and puts unseen questions first", () => {
    const questions = [
      ...Array.from({ length: 4 }, (_, index) => question(`s-${index + 1}`, "SINGLE_CHOICE")),
      ...Array.from({ length: 3 }, (_, index) => question(`m-${index + 1}`, "MULTIPLE_CHOICE")),
    ];
    const answeredIds = new Set(["s-1", "s-2", "m-1"]);
    const result = selectRandomPracticeQuestions(questions, answeredIds, () => 0.42);

    expect(result).toHaveLength(questions.length);
    expect(new Set(result.map((item) => item.id))).toEqual(new Set(questions.map((item) => item.id)));
    expect(result.slice(0, 4).every((item) => !answeredIds.has(item.id))).toBe(true);
    expect(result.slice(4).every((item) => answeredIds.has(item.id))).toBe(true);
  });

  it("selects all random questions when none are answered", () => {
    const questions = Array.from({ length: 5 }, (_, index) => question(`q-${index + 1}`, "SINGLE_CHOICE"));
    const answeredIds = new Set<string>();

    const result = selectRandomPracticeQuestions(questions, answeredIds, () => 0.42);

    expect(result).toHaveLength(5);
    expect(new Set(result.map((item) => item.id))).toEqual(new Set(questions.map((item) => item.id)));
  });

  it("keeps unseen questions ahead of due cards and low-mastery cards", () => {

    const now = new Date("2026-08-21T00:00:00.000Z");

    const questions = ["unseen", "due", "low", "mastered"].map((id) => question(id, "SINGLE_CHOICE"));

    const answeredIds = new Set(["due", "low", "mastered"]);

    const stateByQuestionId = new Map<string, RandomQuestionState>([

      ["due", randomState({ dueAt: new Date("2026-08-20T00:00:00.000Z"), wrongCount: 3 })],

      ["low", randomState({ dueAt: new Date("2026-08-22T00:00:00.000Z"), intervalDays: 4 })],

      ["mastered", randomState({ dueAt: new Date("2026-08-22T00:00:00.000Z"), intervalDays: 7 })],

    ]);



    const result = selectRandomPracticeQuestions(questions, answeredIds, () => 0.42, { stateByQuestionId, now });



    expect(result[0].id).toBe("unseen");

    expect(result.slice(1).map((item) => item.id)).toEqual(["due", "low", "mastered"]);

  });



  it("orders due cards by favorite, dueAt, wrongCount, then ignored after unseen are cleared", () => {

    const now = new Date("2026-08-21T00:00:00.000Z");

    const earlier = new Date("2026-08-19T00:00:00.000Z");

    const laterDue = new Date("2026-08-20T00:00:00.000Z");

    const future = new Date("2026-08-22T00:00:00.000Z");

    const questions = ["favorite-due", "urgent", "ignored", "due-later", "favorite-mastered", "low", "mastered"].map((id) => question(id, "SINGLE_CHOICE"));

    const answeredIds = new Set(questions.map((question) => question.id));

    const stateByQuestionId = new Map<string, RandomQuestionState>([

      ["favorite-due", randomState({ favorite: true, dueAt: laterDue, wrongCount: 4 })],

      ["urgent", randomState({ dueAt: earlier, wrongCount: 5 })],

      ["ignored", randomState({ dueAt: earlier, wrongCount: 2, ignored: true })],

      ["due-later", randomState({ dueAt: laterDue, wrongCount: 1 })],

      ["favorite-mastered", randomState({ favorite: true, dueAt: future, intervalDays: 7 })],

      ["low", randomState({ dueAt: future, intervalDays: 5, wrongCount: 1 })],

      ["mastered", randomState({ dueAt: future, intervalDays: 7 })],

    ]);



    const result = selectRandomPracticeQuestions(questions, answeredIds, () => 0.42, { stateByQuestionId, now });



    expect(result.map((item) => item.id)).toEqual([

      "favorite-due",

      "urgent",

      "ignored",

      "due-later",

      "favorite-mastered",

      "low",

      "mastered",

    ]);

  });



  it("detects random stage completion only when every question has reps, no due card, and intervalDays >= 7", () => {

    const now = new Date("2026-08-21T00:00:00.000Z");

    const future = new Date("2026-08-28T00:00:00.000Z");

    const mastered = randomState({ reps: 2, dueAt: future, intervalDays: 7 });



    expect(isRandomStageCompleted([{ id: "q1" }, { id: "q2" }], new Map([["q1", mastered], ["q2", mastered]]), now)).toBe(true);

    expect(isRandomStageCompleted([{ id: "q1" }, { id: "q2" }], new Map([["q1", mastered]]), now)).toBe(false);

    expect(isRandomStageCompleted([{ id: "q1" }], new Map([["q1", { ...mastered, dueAt: new Date("2026-08-20T00:00:00.000Z") }]]), now)).toBe(false);

    expect(isRandomStageCompleted([{ id: "q1" }], new Map([["q1", { ...mastered, intervalDays: 6 }]]), now)).toBe(false);

    expect(isRandomStageCompleted([{ id: "q1" }], new Map([["q1", { ...mastered, reps: 0 }]]), now)).toBe(false);

    expect(isRandomStageCompleted([], new Map(), now)).toBe(false);

  });

});
