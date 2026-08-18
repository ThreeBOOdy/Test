import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import {
  getAiProvider,
  type AiMessage as ProviderAiMessage,
  type AiProvider,
} from "@/lib/server/ai/provider";

export const AI_TUTOR_ACTION = "AI_TUTOR_CHAT";
export const AI_TUTOR_DAILY_LIMIT_DEFAULT = 50;
export const AI_MESSAGE_ROLE_USER = "USER";
export const AI_MESSAGE_ROLE_ASSISTANT = "ASSISTANT";
export const AI_FEEDBACK_HELPFUL = "HELPFUL";
export const AI_FEEDBACK_NOT_HELPFUL = "NOT_HELPFUL";
export const AI_TUTOR_FEEDBACKS = [AI_FEEDBACK_HELPFUL, AI_FEEDBACK_NOT_HELPFUL] as const;
export type AiTutorFeedback = (typeof AI_TUTOR_FEEDBACKS)[number];

export type AiTutorQuestionContext = {
  id: string;
  stem: string;
  options: unknown;
  correctOptionIds: unknown;
  levelName: string;
  knowledgePointName: string;
  type: string | null;
  explanation: string | null;
};

export type AiTutorStudentStats = {
  wrongCountForQuestion: number;
  wrongCountForKnowledgePoint: number;
  recentWrongStems: string[];
};

export type AiTutorHistoryMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
};

export type PreparedAiTutorChat = {
  conversationId: string;
  questionId: string;
  provider: AiProvider;
  messages: ProviderAiMessage[];
  isFollowUp: boolean;
};

type JsonObject = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function optionList(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (option && typeof option === "object") {
      const record = option as JsonObject;
      const id = asString(record.id).trim() || String.fromCharCode(65 + index);
      const text = asString(record.text);
      return text ? `${id}. ${text}` : `${id}.`;
    }
    return `${String.fromCharCode(65 + index)}. ${asString(option)}`;
  });
}

function correctAnswerText(correctOptionIds: unknown): string {
  if (Array.isArray(correctOptionIds)) {
    const ids = correctOptionIds.map(asString).filter(Boolean);
    return ids.length > 0 ? ids.join(", ") : "（未提供）";
  }
  const value = asString(correctOptionIds).trim();
  return value || "（未提供）";
}

function questionTypeLabel(type: string | null | undefined): string {
  if (type === "MULTIPLE_CHOICE") return "多选题（可能不止一个正确选项）";
  if (type === "SINGLE_CHOICE") return "单选题";
  return "选择题";
}

function parseApprovedExplanation(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as JsonObject;
    const parts = [parsed.summary, parsed.knowledge, parsed.memory]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    if (parts.length > 0) return parts.join("\n");
  } catch {
    // The stored value may be plain text from the older fallback path.
  }
  return value.trim() || null;
}

export function getAiTutorDailyLimit(env: Record<string, string | undefined> = process.env) {
  const raw = env.AI_TUTOR_DAILY_LIMIT?.trim();
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : AI_TUTOR_DAILY_LIMIT_DEFAULT;
}

function startOfUtcDay(now: Date) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function getAiTutorDailyUsageCount(
  userId: string,
  now = new Date(),
  client: Pick<typeof prisma, "aiUsageLog"> = prisma,
) {
  const since = startOfUtcDay(now);
  return client.aiUsageLog.count({
    where: {
      userId,
      action: AI_TUTOR_ACTION,
      createdAt: { gte: since },
    },
  });
}

export async function checkAiTutorDailyLimit(
  userId: string,
  options: { now?: Date; limit?: number; client?: Pick<typeof prisma, "aiUsageLog"> } = {},
) {
  const limit = options.limit ?? getAiTutorDailyLimit();
  const now = options.now ?? new Date();
  const used = await getAiTutorDailyUsageCount(userId, now, options.client ?? prisma);
  if (used >= limit) {
    throw new ApiError(`今日 AI 答疑次数已用完（每天最多 ${limit} 次）`, 429);
  }
  return { used, limit };
}

function buildHistoryMessages(history: readonly AiTutorHistoryMessage[]): ProviderAiMessage[] {
  return history.map((message) => ({
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content,
  }));
}

export function buildTutorPrompt(
  context: AiTutorQuestionContext,
  stats: AiTutorStudentStats,
  history: readonly AiTutorHistoryMessage[],
  userMessage: string,
): ProviderAiMessage[] {
  const optionsText = optionList(context.options).join("\n") || "（无选项）";
  const answerText = correctAnswerText(context.correctOptionIds);
  const isFollowUp = history.some((message) => message.role === "ASSISTANT");
  const explanation = isFollowUp ? parseApprovedExplanation(context.explanation) : null;
  const recentWrong = stats.recentWrongStems.length
    ? stats.recentWrongStems.map((stem, index) => `${index + 1}. ${stem}`).join("\n")
    : "（暂无）";

  const system = [
    "你是一名熟悉中国无线电法规、业余无线电考试和对应等级知识点的苏格拉底式答疑教练。",
    "你的目标是引导学生自己发现答案，而不是直接给出完整解析。",
    "严禁在首次回复中直接给出正确答案或完整解析；只能给提示、追问、拆解思路。",
    "如果学生已经追问（对话中已有过你的回复），可以给出更完整的解析，但仍应先确认学生理解。",
    "不要输出身份证号、手机号、住址等任何个人信息；对话中只讨论题目和知识点。",
  ].join("\n");

  const user = [
    "请根据以下题目和该生的学习情况回答。",
    "",
    `题目等级：${context.levelName}`,
    `知识点：${context.knowledgePointName}`,
    `题型：${questionTypeLabel(context.type)}`,
    "题干：",
    context.stem,
    "选项：",
    optionsText,
    `标准答案：${answerText}`,
    "",
    `该生本题累计答错 ${stats.wrongCountForQuestion} 次；`,
    `该知识点下累计有 ${stats.wrongCountForKnowledgePoint} 道错题。`,
    "该生近期同类错题：",
    recentWrong,
    "",
    isFollowUp ? "学生已经追问，本次可以给出更完整的解析，但请保持讲解清晰、有层次。" : "学生是首次提问，请只给出提示和引导，不要直接给出答案或完整解析。",
    ...(explanation ? ["可参考已审核的解析：", explanation, ""] : []),
    "学生的问题：",
    userMessage,
  ].join("\n");

  return [
    { role: "system", content: system },
    ...buildHistoryMessages(history),
    { role: "user", content: user },
  ];
}

export async function getAiTutorContext(
  userId: string,
  questionId: string,
  practiceSessionId?: string | null,
): Promise<{ context: AiTutorQuestionContext; stats: AiTutorStudentStats }> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      levels: { include: { level: { select: { name: true } } } },
      knowledgePoint: { select: { id: true, name: true } },
    },
  });
  if (!question) throw new ApiError("题目不存在", 404);

  if (practiceSessionId) {
    const session = await prisma.practiceSession.findFirst({
      where: { id: practiceSessionId, userId },
      include: { questions: { where: { questionId }, select: { id: true } } },
    });
    if (!session) throw new ApiError("练习不存在或不属于当前学生", 404);
    if (session.questions.length === 0) throw new ApiError("题目不属于该练习", 400);
  }

  const [wrongQuestion, knowledgeWrongCount, recentWrong, wrongAnswerInSession] = await Promise.all([
    prisma.wrongQuestion.findUnique({ where: { userId_questionId: { userId, questionId } } }),
    prisma.wrongQuestion.count({
      where: { userId, mastered: false, question: { knowledgePointId: question.knowledgePointId } },
    }),
    prisma.wrongQuestion.findMany({
      where: { userId, mastered: false, question: { knowledgePointId: question.knowledgePointId, id: { not: questionId } } },
      select: { question: { select: { stem: true } } },
      orderBy: { lastWrongAt: "desc" },
      take: 3,
    }),
    prisma.practiceAnswer.findFirst({
      where: { questionId, isCorrect: false, session: { userId } },
      select: { id: true },
    }),
  ]);

  if (!wrongQuestion && !wrongAnswerInSession) {
    throw new ApiError("只有答错的题目才能向 AI 提问", 403);
  }

  return {
    context: {
      id: question.id,
      stem: question.stem,
      options: question.options,
      correctOptionIds: question.correctOptionIds,
      levelName: question.levels[0]?.level.name ?? "未归类",
      knowledgePointName: question.knowledgePoint.name,
      type: question.type,
      explanation: question.explanationStatus === "APPROVED" ? question.explanation : null,
    },
    stats: {
      wrongCountForQuestion: wrongQuestion?.wrongCount ?? 0,
      wrongCountForKnowledgePoint: knowledgeWrongCount,
      recentWrongStems: recentWrong.map((item) => item.question.stem),
    },
  };
}

export async function getAiTutorHistory(
  conversationId: string,
  userId: string,
  client: Pick<typeof prisma, "aiConversation" | "aiMessage"> = prisma,
): Promise<{ messages: AiTutorHistoryMessage[]; questionId: string }> {
  const conversation = await client.aiConversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) throw new ApiError("对话不存在或不属于当前学生", 404);
  return {
    questionId: conversation.questionId,
    messages: conversation.messages.map((message) => ({
      role: message.role === AI_MESSAGE_ROLE_USER ? "USER" : "ASSISTANT",
      content: message.content,
    })),
  };
}

export async function createAiTutorConversation(input: {
  userId: string;
  questionId: string;
  practiceSessionId?: string | null;
  now?: Date;
}): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  const created = await prisma.aiConversation.create({
    data: {
      userId: input.userId,
      questionId: input.questionId,
      practiceSessionId: input.practiceSessionId ?? null,
      updatedAt: now,
    },
    select: { id: true },
  });
  return created;
}

export async function appendAiTutorUserMessage(input: {
  conversationId: string;
  content: string;
  now?: Date;
}): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  const created = await prisma.aiMessage.create({
    data: {
      conversationId: input.conversationId,
      role: AI_MESSAGE_ROLE_USER,
      content: input.content,
      createdAt: now,
    },
    select: { id: true },
  });
  await prisma.aiConversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: now },
  });
  return created;
}

export async function prepareAiTutorChat(input: {
  userId: string;
  conversationId?: string | null;
  questionId: string;
  practiceSessionId?: string | null;
  message: string;
  provider?: AiProvider;
  now?: Date;
  dailyLimit?: number;
  client?: Pick<typeof prisma, "aiUsageLog" | "aiConversation" | "aiMessage">;
}): Promise<PreparedAiTutorChat> {
  const now = input.now ?? new Date();
  const provider = input.provider ?? getAiProvider();
  const message = input.message.trim();
  if (!message) throw new ApiError("消息不能为空", 400);
  if (message.length > 2000) throw new ApiError("消息不能超过 2000 字", 400);

  await checkAiTutorDailyLimit(input.userId, {
    now,
    limit: input.dailyLimit,
    client: input.client ?? prisma,
  });

  const { context, stats } = await getAiTutorContext(input.userId, input.questionId, input.practiceSessionId);

  let conversationId = input.conversationId;
  let history: AiTutorHistoryMessage[] = [];
  if (conversationId) {
    const conversation = await getAiTutorHistory(conversationId, input.userId, input.client ?? prisma);
    if (conversation.questionId !== input.questionId) {
      throw new ApiError("对话与题目不匹配", 400);
    }
    history = conversation.messages;
  } else {
    const created = await createAiTutorConversation({
      userId: input.userId,
      questionId: input.questionId,
      practiceSessionId: input.practiceSessionId,
      now,
    });
    conversationId = created.id;
  }

  await appendAiTutorUserMessage({ conversationId, content: message, now });

  const messages = buildTutorPrompt(context, stats, history, message);
  const isFollowUp = history.some((item) => item.role === "ASSISTANT");
  return { conversationId, questionId: input.questionId, provider, messages, isFollowUp };
}

export async function recordAiTutorAssistantMessage(input: {
  conversationId: string;
  userId: string;
  questionId: string;
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  now?: Date;
  client?: Pick<typeof prisma, "aiMessage" | "aiConversation" | "aiUsageLog">;
}): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  const requestHash = createHash("sha256")
    .update(`${AI_TUTOR_ACTION}:${input.userId}:${input.questionId}:${now.toISOString()}`)
    .digest("hex");

  const messageData = {
    conversationId: input.conversationId,
    role: AI_MESSAGE_ROLE_ASSISTANT,
    content: input.content,
    createdAt: now,
  };
  const usageData = {
    userId: input.userId,
    action: AI_TUTOR_ACTION,
    provider: input.provider,
    model: input.model,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    latencyMs: input.latencyMs,
    requestHash,
    createdAt: now,
  };

  if (input.client) {
    const created = await input.client.aiMessage.create({ data: messageData, select: { id: true } });
    await input.client.aiConversation.update({ where: { id: input.conversationId }, data: { updatedAt: now } });
    await input.client.aiUsageLog.create({ data: usageData });
    return created;
  }

  const created = await prisma.aiMessage.create({ data: messageData, select: { id: true } });
  await prisma.aiConversation.update({ where: { id: input.conversationId }, data: { updatedAt: now } });
  await prisma.aiUsageLog.create({ data: usageData });
  return created;
}

export async function submitAiTutorFeedback(input: {
  userId: string;
  messageId: string;
  feedback: string;
}): Promise<{ saved: true }> {
  if (!AI_TUTOR_FEEDBACKS.includes(input.feedback as AiTutorFeedback)) {
    throw new ApiError("反馈类型无效", 400);
  }
  const message = await prisma.aiMessage.findUnique({
    where: { id: input.messageId },
    include: { conversation: { select: { userId: true } } },
  });
  if (!message || message.conversation.userId !== input.userId) {
    throw new ApiError("消息不存在", 404);
  }
  if (message.role !== AI_MESSAGE_ROLE_ASSISTANT) {
    throw new ApiError("只能对 AI 回复提交反馈", 400);
  }
  await prisma.aiMessage.update({
    where: { id: input.messageId },
    data: { feedback: input.feedback },
  });
  return { saved: true };
}

export function parseApprovedExplanationForPrompt(value: string | null) {
  return parseApprovedExplanation(value);
}
