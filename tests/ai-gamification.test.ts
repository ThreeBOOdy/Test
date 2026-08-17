import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicPlayerStatus } from "@/lib/domain/rpg";
import { MockProvider } from "@/lib/server/ai/provider";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  aiUsageLogCreate: vi.fn(),
  getTodayReviewPlan: vi.fn(),
  getPlayerStatus: vi.fn(),
  getFocusOverview: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    aiUsageLog: { create: mocks.aiUsageLogCreate },
  },
}));

vi.mock("@/lib/server/review-plan-service", () => ({
  getTodayReviewPlan: mocks.getTodayReviewPlan,
}));

vi.mock("@/lib/server/rpg-service", () => ({
  getPlayerStatus: mocks.getPlayerStatus,
}));

vi.mock("@/lib/server/focus-service", () => ({
  getFocusOverview: mocks.getFocusOverview,
}));

import {
  AI_DAILY_ENCOURAGEMENT_ACTION,
  AI_MILESTONE_FEEDBACK_ACTION,
  buildDailyEncouragementPrompt,
  buildMilestoneFeedbackPrompt,
  generateDailyEncouragement,
  generateMilestoneFeedback,
  parseEncouragementResponse,
  parseMilestoneFeedbackResponse,
} from "@/lib/server/ai/gamification";

const plan = {
  id: "plan-1",
  planDate: "2026-08-18",
  type: "DAILY" as const,
  status: "ACTIVE" as const,
  examDate: null,
  completedAt: null,
  total: 5,
  completed: 2,
  cards: [],
};

const status: PublicPlayerStatus = {
  xp: 50,
  level: 1,
  title: "见习报务员",
  currentLevelXp: 0,
  nextLevelXp: 80,
  levelProgress: 62,
  gamificationEnabled: true,
  mapEnabled: true,
  todayQuests: [
    { id: "quest-practice", questDate: "2026-08-18", type: "PRACTICE", title: "今日刷题", description: "", target: 20, progress: 20, status: "COMPLETED", ready: false, xpReward: 50, completedAt: "2026-08-18T12:00:00.000Z" },
    { id: "quest-review", questDate: "2026-08-18", type: "REVIEW", title: "今日复习", description: "", target: 5, progress: 2, status: "IN_PROGRESS", ready: false, xpReward: 40, completedAt: null },
  ],
};

const focus = {
  currentStreak: 3,
  todayCheckedIn: true,
  todayFocusMinutes: 25,
  activeFocusSession: null,
};

describe("AI gamification prompts", () => {
  it("builds a daily encouragement prompt from today plan and status", () => {
    const messages = buildDailyEncouragementPrompt({
      displayName: "小张",
      plan,
      status,
      focus,
    });
    const user = messages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("学生：小张");
    expect(user).toContain("今日复习计划：共 5 张卡片，已完成 2 张");
    expect(user).toContain("今日任务完成：1/2 个（今日刷题）");
    expect(user).toContain("今日 25 分钟");
    expect(messages[0].role).toBe("system");
  });

  it("builds a milestone feedback prompt for level up, quest and boss events", () => {
    const levelUp = buildMilestoneFeedbackPrompt({ type: "LEVEL_UP", level: 3, title: "熟练操作员" });
    expect(levelUp[1].content).toContain("Lv.3 熟练操作员");

    const quest = buildMilestoneFeedbackPrompt({ type: "QUEST_COMPLETE", questTitle: "今日刷题", xpReward: 50 });
    expect(quest[1].content).toContain("今日刷题");
    expect(quest[1].content).toContain("获得 50 XP");

    const boss = buildMilestoneFeedbackPrompt({ type: "BOSS_CLEAR", correct: 9, total: 10, passed: true });
    expect(boss[1].content).toContain("9/10");
    expect(boss[1].content).toContain("成功击败 Boss");
  });
});

describe("parse AI gamification responses", () => {
  it("parses JSON encouragement and milestone feedback", () => {
    expect(parseEncouragementResponse(JSON.stringify({ encouragement: "继续保持！" }))).toBe("继续保持！");
    expect(parseMilestoneFeedbackResponse(JSON.stringify({ feedback: "干得漂亮！" }))).toBe("干得漂亮！");
  });

  it("falls back to plain text", () => {
    expect(parseEncouragementResponse("Mock AI 响应")).toBe("Mock AI 响应");
    expect(parseMilestoneFeedbackResponse("Mock AI 响应")).toBe("Mock AI 响应");
  });
});

describe("generate AI gamification feedback", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.userFindUnique.mockResolvedValue({ displayName: "小张" });
    mocks.getTodayReviewPlan.mockResolvedValue(plan);
    mocks.getPlayerStatus.mockResolvedValue(status);
    mocks.getFocusOverview.mockResolvedValue(focus);
    mocks.aiUsageLogCreate.mockResolvedValue({ id: "log-1" });
  });

  it("generates daily encouragement and records an AiUsageLog", async () => {
    const provider = new MockProvider({
      content: JSON.stringify({ encouragement: "今天也稳稳前进！" }),
      model: "mock-model",
      usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
    });

    const result = await generateDailyEncouragement("user-1", { provider, now: new Date("2026-08-18T12:00:00.000Z") });

    expect(result).toMatchObject({
      text: "今天也稳稳前进！",
      model: "mock-model",
      disclaimer: "AI 生成，仅供参考",
      generatedAt: "2026-08-18T12:00:00.000Z",
    });
    expect(mocks.aiUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: AI_DAILY_ENCOURAGEMENT_ACTION,
        provider: "mock",
        model: "mock-model",
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        latencyMs: expect.any(Number),
        requestHash: expect.any(String),
      }),
    });
  });

  it("generates milestone feedback and records an AiUsageLog", async () => {
    const provider = new MockProvider({
      content: JSON.stringify({ feedback: "Boss 已被击败，继续保持！" }),
      model: "mock-model",
      usage: { promptTokens: 10, completionTokens: 6, totalTokens: 16 },
    });

    const result = await generateMilestoneFeedback(
      "user-1",
      { type: "BOSS_CLEAR", correct: 9, total: 10, passed: true },
      { provider, now: new Date("2026-08-18T12:00:00.000Z") },
    );

    expect(result.text).toBe("Boss 已被击败，继续保持！");
    expect(mocks.aiUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: AI_MILESTONE_FEEDBACK_ACTION,
        provider: "mock",
        model: "mock-model",
        promptTokens: 10,
        completionTokens: 6,
        totalTokens: 16,
      }),
    });
  });
});
