import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  knowledgePointFindMany: vi.fn(),
  practiceAnswerFindMany: vi.fn(),
  wrongQuestionFindMany: vi.fn(),
  knowledgePracticeRuleFindMany: vi.fn(),
  questionFindMany: vi.fn(),
  playerProfileUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgePoint: { findMany: mocks.knowledgePointFindMany },
    practiceAnswer: { findMany: mocks.practiceAnswerFindMany },
    wrongQuestion: { findMany: mocks.wrongQuestionFindMany },
    knowledgePracticeRule: { findMany: mocks.knowledgePracticeRuleFindMany },
    question: { findMany: mocks.questionFindMany },
    playerProfile: { upsert: mocks.playerProfileUpsert },
  },
}));

import { getStudentKnowledgeMap } from "@/lib/server/knowledge-map-service";

const points = [
  { id: "kp-1", code: "1", name: "无线电基础", parentId: null, path: "/1", depth: 0, sortOrder: 0, enabled: true },
  { id: "kp-1-1", code: "1.1", name: "电波基础", parentId: "kp-1", path: "/1/1", depth: 1, sortOrder: 0, enabled: true },
  { id: "kp-1-2", code: "1.2", name: "中继台", parentId: "kp-1", path: "/1/2", depth: 2, sortOrder: 1, enabled: true },
];

const answers = [
  { isCorrect: true, question: { knowledgePointId: "kp-1-1" } },
  { isCorrect: true, question: { knowledgePointId: "kp-1-1" } },
  { isCorrect: true, question: { knowledgePointId: "kp-1-1" } },
  { isCorrect: false, question: { knowledgePointId: "kp-1-2" } },
];

const wrongQuestions = [{ question: { knowledgePointId: "kp-1-2" } }];

const rules = [
  {
    id: "rule-1",
    knowledgePointId: "kp-1-1",
    levelId: "level-a",
    singleCount: 1,
    multipleCount: 0,
    enabled: true,
    level: { code: "A" },
    knowledgePoint: { id: "kp-1-1", depth: 1 },
  },
  {
    id: "rule-2",
    knowledgePointId: "kp-1-2",
    levelId: "level-a",
    singleCount: 1,
    multipleCount: 0,
    enabled: true,
    level: { code: "A" },
    knowledgePoint: { id: "kp-1-2", depth: 2 },
  },
];

const questions = [
  { levels: [{ levelId: "level-a" }], knowledgePointId: "kp-1-1", type: "SINGLE_CHOICE" },
  { levels: [{ levelId: "level-a" }], knowledgePointId: "kp-1-2", type: "SINGLE_CHOICE" },
];

describe("knowledge map service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.knowledgePointFindMany.mockResolvedValue(points);
    mocks.practiceAnswerFindMany.mockResolvedValue(answers);
    mocks.wrongQuestionFindMany.mockResolvedValue(wrongQuestions);
    mocks.knowledgePracticeRuleFindMany.mockResolvedValue(rules);
    mocks.questionFindMany.mockResolvedValue(questions);
    mocks.playerProfileUpsert.mockResolvedValue({ userId: "user-1", mapEnabled: true });
  });

  it("builds a knowledge map with mastery stats and available dungeon links", async () => {
    const map = await getStudentKnowledgeMap("user-1");

    expect(map.mapEnabled).toBe(true);
    expect(map.stats.total).toBe(3);
    expect(map.stats.weak).toBe(2);
    expect(map.stats.mastered).toBe(1);

    const root = map.nodes[0];
    expect(root.answered).toBe(4);
    expect(root.correct).toBe(3);

    const weakChild = root.children.find((child) => child.id === "kp-1-2");
    expect(weakChild?.status).toBe("weak");
    expect(weakChild?.practiceHref).toContain("/student/practice/start?mode=knowledge");
    expect(weakChild?.practiceHref).toContain("knowledge=kp-1-2");

    const shallowChild = root.children.find((child) => child.id === "kp-1-1");
    expect(shallowChild?.hasPractice).toBe(true);
    expect(shallowChild?.practiceHref).toContain("knowledge=kp-1-1");
  });

  it("does not offer a dungeon when the knowledge rule inventory is insufficient", async () => {
    mocks.questionFindMany.mockResolvedValue([
      { levels: [{ levelId: "level-a" }], knowledgePointId: "kp-1-1", type: "SINGLE_CHOICE" },
    ]);

    const map = await getStudentKnowledgeMap("user-1");
    const weakChild = map.nodes[0].children.find((child) => child.id === "kp-1-2");
    expect(weakChild?.status).toBe("weak");
    expect(weakChild?.hasPractice).toBe(false);
    expect(weakChild?.practiceHref).toBeUndefined();
  });

  it("uses the profile mapEnabled flag as the hidden-entry switch", async () => {
    mocks.playerProfileUpsert.mockResolvedValue({ userId: "user-1", mapEnabled: false });

    const map = await getStudentKnowledgeMap("user-1");
    expect(map.mapEnabled).toBe(false);
  });
});
