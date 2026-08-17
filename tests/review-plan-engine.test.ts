import { describe, expect, it } from "vitest";
import {
  buildReviewCards,
  computeExamSprintTarget,
  DAILY_REVIEW_TARGET,
  DEFAULT_WEAK_KNOWLEDGE_LIMIT,
  DEFAULT_WRONG_QUESTION_LIMIT,
  WEAK_ACCURACY_THRESHOLD,
} from "@/lib/domain/review-plan-engine";
import type { BuildReviewCardsInput } from "@/lib/domain/review-plan-engine";

const wrongQuestions = [
  { questionId: "w-1", knowledgePointId: "kp-1", wrongCount: 3, lastWrongAt: new Date("2026-08-01T00:00:00.000Z") },
  { questionId: "w-2", knowledgePointId: "kp-2", wrongCount: 1, lastWrongAt: new Date("2026-08-10T00:00:00.000Z") },
];

const weakKnowledgePoints = [
  { knowledgePointId: "kp-3", answered: 5, correct: 1, accuracy: 20 },
  { knowledgePointId: "kp-4", answered: 10, correct: 2, accuracy: 20 },
  { knowledgePointId: "kp-5", answered: 2, correct: 0, accuracy: 0 },
  { knowledgePointId: "kp-6", answered: 6, correct: 5, accuracy: 83 },
];

const questions = [
  { id: "q-1", knowledgePointId: "kp-3", levelId: "A" },
  { id: "q-2", knowledgePointId: "kp-3", levelId: "A" },
  { id: "q-3", knowledgePointId: "kp-4", levelId: "A" },
  { id: "q-4", knowledgePointId: "kp-4", levelId: "A" },
  { id: "q-5", knowledgePointId: "kp-5", levelId: "A" },
  { id: "q-6", knowledgePointId: "kp-6", levelId: "A" },
];

function input(overrides: Partial<BuildReviewCardsInput> = {}): BuildReviewCardsInput {
  return {
    wrongQuestions,
    weakKnowledgePoints,
    questions,
    target: DAILY_REVIEW_TARGET,
    ...overrides,
  };
}

describe("review plan engine", () => {
  it("puts unmastered wrong questions first with higher priority", () => {
    const cards = buildReviewCards(input({ target: 10, random: () => 0.42 }));

    expect(cards.slice(0, 2).map((card) => card.questionId)).toEqual(["w-1", "w-2"]);
    expect(cards.slice(0, 2).every((card) => card.source === "WRONG_QUESTION")).toBe(true);
    expect(cards[0].priority).toBeGreaterThan(cards[2].priority);
    expect(cards[0].priority).toBeGreaterThan(cards[1].priority);
  });

  it("filters weak knowledge points by answer count and accuracy", () => {
    const cards = buildReviewCards(input({ target: 10, random: () => 0.42 }));

    const weakCards = cards.filter((card) => card.source === "WEAK_KNOWLEDGE");
    expect(weakCards.every((card) => card.knowledgePointId === "kp-3" || card.knowledgePointId === "kp-4")).toBe(true);
    expect(weakCards.some((card) => card.knowledgePointId === "kp-5")).toBe(false);
    expect(weakCards.some((card) => card.knowledgePointId === "kp-6")).toBe(false);
  });

  it("fills remaining target without duplicate questions", () => {
    const cards = buildReviewCards(input({ target: 6, random: () => 0.42 }));

    expect(cards).toHaveLength(6);
    expect(new Set(cards.map((card) => card.questionId)).size).toBe(6);
    expect(cards.filter((card) => card.source === "WRONG_QUESTION")).toHaveLength(2);
    expect(cards.filter((card) => card.source === "WEAK_KNOWLEDGE")).toHaveLength(4);
  });

  it("respects wrong question and weak knowledge limits", () => {
    const cards = buildReviewCards(input({ target: 10, wrongQuestionLimit: 1, weakKnowledgeLimit: 1, random: () => 0.42 }));

    const weakCards = cards.filter((card) => card.source === "WEAK_KNOWLEDGE");
    expect(cards.filter((card) => card.source === "WRONG_QUESTION")).toHaveLength(1);
    expect(weakCards.length).toBeGreaterThan(0);
    expect(new Set(weakCards.map((card) => card.knowledgePointId)).size).toBe(1);
  });

  it("can return fewer cards when the candidate pool is exhausted", () => {
    const cards = buildReviewCards(input({ target: 20, random: () => 0.42 }));

    expect(cards.length).toBeLessThanOrEqual(2 + 4);
  });

  it("computes exam sprint daily targets with clamping and countdown pressure", () => {
    expect(computeExamSprintTarget({ totalCandidates: 100, daysUntilExam: 1 })).toBe(30);
    expect(computeExamSprintTarget({ totalCandidates: 100, daysUntilExam: 10 })).toBe(10);
    expect(computeExamSprintTarget({ totalCandidates: 20, daysUntilExam: 10 })).toBe(DAILY_REVIEW_TARGET);
    expect(computeExamSprintTarget({ totalCandidates: 5, daysUntilExam: 0 })).toBe(DAILY_REVIEW_TARGET);
  });
});

describe("review plan defaults", () => {
  it("keeps constants in a sane range for the current product", () => {
    expect(DAILY_REVIEW_TARGET).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_WRONG_QUESTION_LIMIT).toBeGreaterThan(0);
    expect(DEFAULT_WEAK_KNOWLEDGE_LIMIT).toBeGreaterThan(0);
    expect(WEAK_ACCURACY_THRESHOLD).toBeLessThanOrEqual(100);
  });
});
