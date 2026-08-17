import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProvider } from "@/lib/server/ai/provider";
import {
  AI_FEEDBACK_HELPFUL,
  AI_MESSAGE_ROLE_ASSISTANT,
  AI_TUTOR_ACTION,
  buildTutorPrompt,
  getAiTutorDailyLimit,
  prepareAiTutorChat,
  recordAiTutorAssistantMessage,
  submitAiTutorFeedback,
} from "@/lib/server/ai/tutor";

const mocks = vi.hoisted(() => ({
  aiUsageLogCount: vi.fn(),
  aiUsageLogCreate: vi.fn(),
  practiceSessionFindFirst: vi.fn(),
  questionFindUnique: vi.fn(),
  wrongQuestionFindUnique: vi.fn(),
  wrongQuestionCount: vi.fn(),
  wrongQuestionFindMany: vi.fn(),
  practiceAnswerFindFirst: vi.fn(),
  aiConversationCreate: vi.fn(),
  aiConversationUpdate: vi.fn(),
  aiConversationFindFirst: vi.fn(),
  aiMessageCreate: vi.fn(),
  aiMessageFindUnique: vi.fn(),
  aiMessageUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    aiUsageLog: { count: mocks.aiUsageLogCount, create: mocks.aiUsageLogCreate },
    practiceSession: { findFirst: mocks.practiceSessionFindFirst },
    question: { findUnique: mocks.questionFindUnique },
    wrongQuestion: {
      findUnique: mocks.wrongQuestionFindUnique,
      count: mocks.wrongQuestionCount,
      findMany: mocks.wrongQuestionFindMany,
    },
    practiceAnswer: { findFirst: mocks.practiceAnswerFindFirst },
    aiConversation: {
      create: mocks.aiConversationCreate,
      update: mocks.aiConversationUpdate,
      findFirst: mocks.aiConversationFindFirst,
    },
    aiMessage: {
      create: mocks.aiMessageCreate,
      findUnique: mocks.aiMessageFindUnique,
      update: mocks.aiMessageUpdate,
    },
  },
}));

const sampleQuestion = {
  id: "q-1",
  levelId: "level-1",
  knowledgePointId: "point-1",
  externalQuestionCode: "EX-1",
  stem: "中继台下行频率应避开哪些业务频率？",
  type: "SINGLE_CHOICE",
  optionCount: 3,
  correctOptionCount: 1,
  selectionSpec: "3选1",
  options: [
    { id: "A", text: "广播电视业务" },
    { id: "B", text: "航空移动业务" },
    { id: "C", text: "水上移动业务" },
  ],
  correctOptionIds: ["B"],
  status: "ACTIVE",
  version: 1,
  explanationStatus: "APPROVED",
  explanation: JSON.stringify({ summary: "航空业务优先，中继让路", knowledge: "中继台应避开航空移动业务频率", memory: "航空优先" }),
  levelName: "A 级",
  knowledgePointName: "中继台频率使用规则",
  level: { name: "A 级" },
  knowledgePoint: { id: "point-1", name: "中继台频率使用规则" },
};

const stats = {
  wrongCountForQuestion: 2,
  wrongCountForKnowledgePoint: 3,
  recentWrongStems: ["上行频率应避开哪些业务？", "中继台天线高度如何选择？"],
};

describe("getAiTutorDailyLimit", () => {
  it("defaults to 50 and reads env override", () => {
    expect(getAiTutorDailyLimit({})).toBe(50);
    expect(getAiTutorDailyLimit({ AI_TUTOR_DAILY_LIMIT: "12" })).toBe(12);
    expect(getAiTutorDailyLimit({ AI_TUTOR_DAILY_LIMIT: "abc" })).toBe(50);
  });
});

describe("buildTutorPrompt", () => {
  it("asks for a hint first and does not instruct full answer on first turn", () => {
    const messages = buildTutorPrompt(sampleQuestion, stats, [], "为什么选 B？");
    const system = messages.find((message) => message.role === "system")?.content ?? "";
    const user = messages.find((message) => message.role === "user")?.content ?? "";

    expect(system).toContain("而不是直接给出完整解析");
    expect(system).toContain("苏格拉底式");
    expect(user).toContain("只给出提示和引导");
    expect(user).toContain("标准答案：B");
    expect(user).toContain("该生本题累计答错 2 次");
    expect(user).not.toContain("可以给出更完整的解析");
  });

  it("allows a fuller explanation after the student has followed up", () => {
    const messages = buildTutorPrompt(
      sampleQuestion,
      stats,
      [{ role: "ASSISTANT", content: "先想想：中继台下行是否应该避开航空业务？" }],
      "请完整解析",
    );
    const user = messages.find((message) => message.role === "user")?.content ?? "";

    expect(user).toContain("可以给出更完整的解析");
    expect(user).toContain("可参考已审核的解析");
  });

  it("never includes personal identifiers in the prompt", () => {
    const messages = buildTutorPrompt(sampleQuestion, stats, [], "为什么选 B？");
    const prompt = messages.map((message) => message.content).join("\n");

    expect(prompt).not.toMatch(/\d{17}[\dXx]|1[3-9]\d{9}|nationalId|phoneHash|displayName|username/);
  });
});

describe("prepareAiTutorChat", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.aiUsageLogCount.mockResolvedValue(0);
    mocks.practiceSessionFindFirst.mockResolvedValue({ id: "session-1", questions: [{ id: "psq-1" }] });
    mocks.questionFindUnique.mockResolvedValue(sampleQuestion);
    mocks.wrongQuestionFindUnique.mockResolvedValue({ wrongCount: 2 });
    mocks.wrongQuestionCount.mockResolvedValue(3);
    mocks.wrongQuestionFindMany.mockResolvedValue([
      { question: { stem: "上行频率应避开哪些业务？" } },
      { question: { stem: "中继台天线高度如何选择？" } },
    ]);
    mocks.practiceAnswerFindFirst.mockResolvedValue(null);
    mocks.aiConversationCreate.mockResolvedValue({ id: "conv-1" });
    mocks.aiMessageCreate.mockResolvedValue({ id: "msg-user-1" });
    mocks.aiConversationUpdate.mockResolvedValue({ id: "conv-1" });
  });

  it("creates a conversation, persists the user message, and returns hint-mode messages", async () => {
    const provider = new MockProvider({ chunks: ["提示", "一下"] });
    const result = await prepareAiTutorChat({
      userId: "user-1",
      questionId: "q-1",
      practiceSessionId: "session-1",
      message: "为什么选 B？",
      provider,
      now: new Date("2026-08-17T10:00:00.000Z"),
      dailyLimit: 50,
    });

    expect(result.conversationId).toBe("conv-1");
    expect(result.isFollowUp).toBe(false);
    expect(result.messages[result.messages.length - 1]).toMatchObject({ role: "user", content: expect.stringContaining("为什么选 B？") });
    expect(mocks.aiUsageLogCount).toHaveBeenCalled();
    expect(mocks.aiConversationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", questionId: "q-1", practiceSessionId: "session-1" }),
      select: { id: true },
    });
    expect(mocks.aiMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "conv-1", role: "USER", content: "为什么选 B？" }),
      select: { id: true },
    });
  });

  it("reuses an existing conversation and loads its history", async () => {
    mocks.aiConversationFindFirst.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      questionId: "q-1",
      messages: [
        { role: "USER", content: "为什么选 B？" },
        { role: "ASSISTANT", content: "先想想中继台下行应避开哪些业务。" },
      ],
    });

    const result = await prepareAiTutorChat({
      userId: "user-1",
      conversationId: "conv-1",
      questionId: "q-1",
      message: "请完整解析",
      provider: new MockProvider(),
      dailyLimit: 50,
    });

    expect(result.isFollowUp).toBe(true);
    expect(mocks.aiConversationCreate).not.toHaveBeenCalled();
    expect(result.messages.some((message) => message.role === "assistant" && message.content.includes("先想想"))).toBe(true);
  });

  it("rejects when the daily limit has been reached", async () => {
    mocks.aiUsageLogCount.mockResolvedValue(50);

    await expect(prepareAiTutorChat({
      userId: "user-1",
      questionId: "q-1",
      message: "为什么选 B？",
      provider: new MockProvider(),
      dailyLimit: 50,
    })).rejects.toMatchObject({ status: 429 });
    expect(mocks.aiConversationCreate).not.toHaveBeenCalled();
  });

  it("rejects empty or oversized messages", async () => {
    await expect(prepareAiTutorChat({
      userId: "user-1",
      questionId: "q-1",
      message: "   ",
      provider: new MockProvider(),
      dailyLimit: 50,
    })).rejects.toMatchObject({ status: 400 });
    await expect(prepareAiTutorChat({
      userId: "user-1",
      questionId: "q-1",
      message: "x".repeat(2001),
      provider: new MockProvider(),
      dailyLimit: 50,
    })).rejects.toMatchObject({ status: 400 });
  });
});

describe("recordAiTutorAssistantMessage", () => {
  beforeEach(() => {
    mocks.aiMessageCreate.mockReset();
    mocks.aiConversationUpdate.mockReset();
    mocks.aiUsageLogCreate.mockReset();
  });

  it("writes the assistant message, updates conversation, and records usage log", async () => {
    mocks.aiMessageCreate.mockResolvedValue({ id: "msg-ai-1" });
    mocks.aiConversationUpdate.mockResolvedValue({ id: "conv-1" });
    mocks.aiUsageLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await recordAiTutorAssistantMessage({
      conversationId: "conv-1",
      userId: "user-1",
      questionId: "q-1",
      content: "提示内容",
      provider: "mock",
      model: "mock-model",
      latencyMs: 120,
      now: new Date("2026-08-17T10:00:00.000Z"),
    });

    expect(result).toEqual({ id: "msg-ai-1" });
    expect(mocks.aiMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv-1",
        role: AI_MESSAGE_ROLE_ASSISTANT,
        content: "提示内容",
      }),
      select: { id: true },
    });
    expect(mocks.aiUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: AI_TUTOR_ACTION,
        provider: "mock",
        model: "mock-model",
        latencyMs: 120,
      }),
    });
  });
});

describe("submitAiTutorFeedback", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("updates feedback on an assistant message owned by the student", async () => {
    mocks.aiMessageFindUnique.mockResolvedValue({
      id: "msg-ai-1",
      role: AI_MESSAGE_ROLE_ASSISTANT,
      conversation: { userId: "user-1" },
    });
    mocks.aiMessageUpdate.mockResolvedValue({ id: "msg-ai-1", feedback: AI_FEEDBACK_HELPFUL });

    await expect(submitAiTutorFeedback({
      userId: "user-1",
      messageId: "msg-ai-1",
      feedback: AI_FEEDBACK_HELPFUL,
    })).resolves.toEqual({ saved: true });
    expect(mocks.aiMessageUpdate).toHaveBeenCalledWith({
      where: { id: "msg-ai-1" },
      data: { feedback: AI_FEEDBACK_HELPFUL },
    });
  });

  it("rejects feedback on another student's message", async () => {
    mocks.aiMessageFindUnique.mockResolvedValue({
      id: "msg-ai-1",
      role: AI_MESSAGE_ROLE_ASSISTANT,
      conversation: { userId: "other-user" },
    });

    await expect(submitAiTutorFeedback({
      userId: "user-1",
      messageId: "msg-ai-1",
      feedback: AI_FEEDBACK_HELPFUL,
    })).rejects.toMatchObject({ status: 404 });
    expect(mocks.aiMessageUpdate).not.toHaveBeenCalled();
  });
});
