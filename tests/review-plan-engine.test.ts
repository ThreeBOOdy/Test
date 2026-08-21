import { describe, expect, it } from "vitest";
import {
  buildReviewCards,
  computeExamSprintTarget,
  DAILY_REVIEW_TARGET,
  DEFAULT_DUE_QUESTION_LIMIT,
  DEFAULT_WEAK_KNOWLEDGE_LIMIT,
  WEAK_ACCURACY_THRESHOLD,
} from "@/lib/domain/review-plan-engine";
import type { BuildReviewCardsInput, FsrsDueQuestionCandidate } from "@/lib/domain/review-plan-engine";

const dueQuestions: FsrsDueQuestionCandidate[] = [
  {
    questionId: "d-1",
    knowledgePointId: "kp-1",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    difficulty: 7,
    stability: 2,
    lapses: 1,
    wrongCount: 3,
    favorite: false,
    ignored: false,
    lastReviewedAt: new Date("2026-07-30T00:00:00.000Z"),
  },
  {
    questionId: "d-2",
    knowledgePointId: "kp-2",
    dueAt: new Date("2026-08-10T00:00:00.000Z"),
    difficulty: 6,
    stability: 1.5,
    lapses: 0,
    wrongCount: 1,
    favorite: false,
    ignored: false,
    lastReviewedAt: new Date("2026-08-09T00:00:00.000Z"),
  },
];

const weakKnowledgePoints = [
  { knowledgePointId: "kp-3", answered: 5, correct: 1, accuracy: 20 },
  { knowledgePointId: "kp-4", answered: 10, correct: 2, accuracy: 20 },
  { knowledgePointId: "kp-5", answered: 2, correct: 0, accuracy: 0 },
  { knowledgePointId: "kp-6", answered: 6, correct: 5, accuracy: 83 },
];

const questions = [
  { id: "q-1", knowledgePointId: "kp-3" },
  { id: "q-2", knowledgePointId: "kp-3" },
  { id: "q-3", knowledgePointId: "kp-4" },
  { id: "q-4", knowledgePointId: "kp-4" },
  { id: "q-5", knowledgePointId: "kp-5" },
  { id: "q-6", knowledgePointId: "kp-6" },
];

function input(overrides: Partial<BuildReviewCardsInput> = {}): BuildReviewCardsInput {
  return {
    dueQuestions,
    weakKnowledgePoints,
    questions,
    target: DAILY_REVIEW_TARGET,
    ...overrides,
  };
}

describe("review plan engine", () => {
  it("puts due FSRS questions first with higher priority", () => {
    const cards = buildReviewCards(input({ target: 10, random: () => 0.42 }));

    expect(cards.slice(0, 2).map((card) => card.questionId)).toEqual(["d-1", "d-2"]);
    expect(cards.slice(0, 2).every((card) => card.source === "WRONG_QUESTION")).toBe(true);
    expect(cards[0].priority).toBeGreaterThan(cards[2].priority);
    expect(cards[0].priority).toBeGreaterThan(cards[1].priority);
  });

  it("sorts due questions by favorite, dueAt, wrong count, and defers ignored", () => {
    const due = [
      {
        questionId: "later-wrong",
        knowledgePointId: "kp-1",
        dueAt: new Date("2026-08-12T00:00:00.000Z"),
        difficulty: 5,
        stability: 1,
        lapses: 0,
        wrongCount: 1,
        favorite: false,
        ignored: false,
        lastReviewedAt: null,
      },
      {
        questionId: "favorite",
        knowledgePointId: "kp-2",
        dueAt: new Date("2026-08-12T00:00:00.000Z"),
        difficulty: 8,
        stability: 1,
        lapses: 2,
        wrongCount: 4,
        favorite: true,
        ignored: false,
        lastReviewedAt: null,
      },
      {
        questionId: "urgent",
        knowledgePointId: "kp-3",
        dueAt: new Date("2026-08-11T00:00:00.000Z"),
        difficulty: 6,
        stability: 1,
        lapses: 0,
        wrongCount: 5,
        favorite: false,
        ignored: false,
        lastReviewedAt: null,
      },
      {
        questionId: "ignored",
        knowledgePointId: "kp-4",
        dueAt: new Date("2026-08-11T00:00:00.000Z"),
        difficulty: 9,
        stability: 1,
        lapses: 1,
        wrongCount: 2,
        favorite: false,
        ignored: true,
        lastReviewedAt: null,
      },
    ];

    const cards = buildReviewCards(input({
      dueQuestions: due,
      weakKnowledgePoints: [],
      questions: [],
      target: 4,
      dueQuestionLimit: 4,
      random: () => 0.42,
    }));

    expect(cards.map((card) => card.questionId)).toEqual(["favorite", "urgent", "ignored", "later-wrong"]);
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

  it("respects due question and weak knowledge limits", () => {
    const cards = buildReviewCards(input({ target: 10, dueQuestionLimit: 1, weakKnowledgeLimit: 1, random: () => 0.42 }));

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
    expect(DEFAULT_DUE_QUESTION_LIMIT).toBeGreaterThan(0);
    expect(DEFAULT_WEAK_KNOWLEDGE_LIMIT).toBeGreaterThan(0);
    expect(WEAK_ACCURACY_THRESHOLD).toBeLessThanOrEqual(100);
  });
});
