import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { AI_DISCLAIMER, type DailyEncouragement, type MilestoneEvent, type MilestoneFeedback } from "@/lib/domain/gamification";
import { getAiProvider, type AiMessage, type AiProvider } from "@/lib/server/ai/provider";
import { getFocusOverview } from "@/lib/server/focus-service";
import { getTodayReviewPlan } from "@/lib/server/review-plan-service";
import { getPlayerStatus } from "@/lib/server/rpg-service";

export const AI_DAILY_ENCOURAGEMENT_ACTION = "AI_DAILY_ENCOURAGEMENT";
export const AI_MILESTONE_FEEDBACK_ACTION = "AI_MILESTONE_FEEDBACK";

export type DailyEncouragementContext = {
  displayName: string;
  plan: Awaited<ReturnType<typeof getTodayReviewPlan>>;
  status: Awaited<ReturnType<typeof getPlayerStatus>>;
  focus: Awaited<ReturnType<typeof getFocusOverview>>;
};

type JsonObject = Record<string, unknown>;

function extractJsonObject(content: string): JsonObject | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonObject;
  } catch {
    return null;
  }
  return null;
}

function firstString(obj: JsonObject, keys: string[]): string {
  for (const key of keys) {
    if (typeof obj[key] === "string") return obj[key].trim();
  }
  return "";
}

function questSummary(status: Awaited<ReturnType<typeof getPlayerStatus>>): string {
  const completed = status.todayQuests.filter((quest) => quest.status === "COMPLETED");
  const completedText = completed.length ? completed.map((quest) => quest.title).join("、") : "暂无";
  return `今日任务完成：${completed.length}/${status.todayQuests.length} 个（${completedText}）`;
}

export function buildDailyEncouragementPrompt(input: DailyEncouragementContext): AiMessage[] {
  const system = "你是一名熟悉中国无线电证书考试的学习鼓励教练。请根据学生今日复习计划和当前学习状态，生成一句简短、真诚、不夸张的鼓励语。只输出 JSON 对象 {\"encouragement\":\"...\"}，不要输出任何额外文字。";
  const nextLevel = input.status.nextLevelXp == null ? "已满级" : `距下一级还需 ${Math.max(0, input.status.nextLevelXp - input.status.xp)} XP`;
  const planStatus = input.plan.status === "COMPLETED" ? "已完成" : "进行中";
  const user = [
    `学生：${input.displayName}`,
    `今日复习计划：共 ${input.plan.total} 张卡片，已完成 ${input.plan.completed} 张，状态 ${planStatus}`,
    `当前等级：Lv.${input.status.level} ${input.status.title}，累计 ${input.status.xp} XP，${nextLevel}`,
    questSummary(input.status),
    `专注：今日 ${input.focus.todayFocusMinutes} 分钟，连续打卡 ${input.focus.currentStreak} 天`,
    "请输出一句 30 字以内的鼓励语。",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseEncouragementResponse(content: string): string {
  const trimmed = content.trim();
  const json = extractJsonObject(trimmed);
  if (json) {
    const text = firstString(json, ["encouragement", "鼓励", "text"]);
    if (text) return text;
  }
  return trimmed || "今天也保持稳定输出，把每个知识点都变成自己的信号。";
}

export function buildMilestoneFeedbackPrompt(event: MilestoneEvent): AiMessage[] {
  const system = "你是一名熟悉中国无线电证书考试的学习激励教练。请根据学生的游戏化里程碑事件，生成一句个性化反馈。只输出 JSON 对象 {\"feedback\":\"...\"}，不要输出任何额外文字。";
  let user: string;
  if (event.type === "LEVEL_UP") {
    user = `学生刚刚升到 Lv.${event.level} ${event.title}，请祝贺这一进步，并鼓励继续保持稳定的刷题和复习节奏。`;
  } else if (event.type === "QUEST_COMPLETE") {
    user = `学生刚刚完成了今日任务「${event.questTitle}」，获得 ${event.xpReward} XP，请肯定这一具体行动。`;
  } else {
    user = `学生在模拟考试 Boss 战中取得 ${event.correct}/${event.total}，${event.passed ? "成功击败 Boss" : "虽然未击败 Boss 但已尽力"}，请给出符合实际的鼓励。`;
  }
  user += " 请输出一句 60 字以内的反馈。";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseMilestoneFeedbackResponse(content: string): string {
  const trimmed = content.trim();
  const json = extractJsonObject(trimmed);
  if (json) {
    const text = firstString(json, ["feedback", "鼓励", "text"]);
    if (text) return text;
  }
  return trimmed || "完成得不错，继续保持！";
}

export type GenerateDailyEncouragementOptions = {
  provider?: AiProvider;
  now?: Date;
};

export async function generateDailyEncouragement(
  userId: string,
  options: GenerateDailyEncouragementOptions = {},
): Promise<DailyEncouragement> {
  const provider = options.provider ?? getAiProvider();
  const now = options.now ?? new Date();
  const [user, plan, status, focus] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    getTodayReviewPlan(userId, now),
    getPlayerStatus(userId, now),
    getFocusOverview(userId, now),
  ]);

  const messages = buildDailyEncouragementPrompt({
    displayName: user?.displayName ?? "同学",
    plan,
    status,
    focus,
  });
  const startedAt = Date.now();
  const completion = await provider.complete(messages, { temperature: 0.6, maxTokens: 120 });
  const latencyMs = Date.now() - startedAt;
  const text = parseEncouragementResponse(completion.content);
  const requestHash = createHash("sha256")
    .update(`daily-encouragement:${userId}:${now.toISOString().slice(0, 10)}`)
    .digest("hex");

  await prisma.aiUsageLog.create({
    data: {
      userId,
      action: AI_DAILY_ENCOURAGEMENT_ACTION,
      provider: provider.name,
      model: completion.model,
      promptTokens: completion.usage?.promptTokens ?? 0,
      completionTokens: completion.usage?.completionTokens ?? 0,
      totalTokens: completion.usage?.totalTokens ?? 0,
      latencyMs,
      requestHash,
    },
  });

  return {
    text,
    model: completion.model,
    generatedAt: now.toISOString(),
    disclaimer: AI_DISCLAIMER,
  };
}

export type GenerateMilestoneFeedbackOptions = {
  provider?: AiProvider;
  now?: Date;
};

export async function generateMilestoneFeedback(
  userId: string,
  event: MilestoneEvent,
  options: GenerateMilestoneFeedbackOptions = {},
): Promise<MilestoneFeedback> {
  const provider = options.provider ?? getAiProvider();
  const now = options.now ?? new Date();
  const messages = buildMilestoneFeedbackPrompt(event);
  const startedAt = Date.now();
  const completion = await provider.complete(messages, { temperature: 0.7, maxTokens: 120 });
  const latencyMs = Date.now() - startedAt;
  const text = parseMilestoneFeedbackResponse(completion.content);
  const requestHash = createHash("sha256")
    .update(`milestone-feedback:${userId}:${event.type}:${now.toISOString()}`)
    .digest("hex");

  await prisma.aiUsageLog.create({
    data: {
      userId,
      action: AI_MILESTONE_FEEDBACK_ACTION,
      provider: provider.name,
      model: completion.model,
      promptTokens: completion.usage?.promptTokens ?? 0,
      completionTokens: completion.usage?.completionTokens ?? 0,
      totalTokens: completion.usage?.totalTokens ?? 0,
      latencyMs,
      requestHash,
    },
  });

  return {
    text,
    model: completion.model,
    generatedAt: now.toISOString(),
    disclaimer: AI_DISCLAIMER,
  };
}
