import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  getStudentLearningStatistics,
  getTeacherLearningStatistics,
  type LearningStatistics,
  type StudentLearningStatistics,
} from "@/lib/server/learning-statistics-service";
import {
  getAiProvider,
  type AiMessage,
  type AiProvider,
} from "@/lib/server/ai/provider";
import { getDaysAgo } from "@/lib/server/time";

export const STUDENT_WEEKLY_REPORT_ACTION = "LEARNING_REPORT_STUDENT_WEEKLY";
export const TEACHER_CLASS_REPORT_ACTION = "LEARNING_REPORT_TEACHER_CLASS";
export const AI_DISCLAIMER = "AI 生成，仅供参考";

export type StudentReportContent = {
  summary: string;
  weakPoints: string[];
  nextSteps: string[];
  encouragement: string;
};

export type TeacherReportContent = {
  overview: string;
  weakPoints: string[];
  classFocus: string[];
  suggestions: string;
};

export type StudentWeeklyReport = {
  generatedAt: string;
  period: { start: string; end: string; label: string };
  summary: StudentLearningStatistics["summary"];
  weakPoints: StudentLearningStatistics["knowledgePoints"];
  content: StudentReportContent;
  disclaimer: string;
  model: string;
};

export type TeacherClassReport = {
  generatedAt: string;
  period: { start: string; end: string; label: string };
  summary: LearningStatistics["summary"];
  weakPoints: LearningStatistics["knowledgePoints"];
  content: TeacherReportContent;
  disclaimer: string;
  model: string;
};

type JsonObject = Record<string, unknown>;

function knowledgePointLines(points: StudentLearningStatistics["knowledgePoints"] | LearningStatistics["knowledgePoints"]): string {
  if (!points.length) return "- 暂无足够答题数据";
  return points.map((point) => `- ${point.code} ${point.name}：答 ${point.answered} 题，正确率 ${point.accuracy}%`).join("\n");
}

export function buildStudentWeeklyReportPrompt(stats: StudentLearningStatistics): AiMessage[] {
  const system = "你是一名熟悉中国无线电证书考试的教学分析师。请根据学生本周的答题统计数据，生成一份鼓励但不失客观的学情周报。只输出 JSON，不要输出任何额外文字。";
  const user = [
    "请根据以下本周统计生成学生周报，只输出一个 JSON 对象，包含四个字段：",
    '- "summary"：用 1-2 句话概括本周表现，不超过 100 字。',
    '- "weakPoints"：字符串数组，列出最需要加强的知识点，每条不超过 30 字；没有薄弱点则给空数组。',
    '- "nextSteps"：字符串数组，给出下一步学习建议，2-4 条，每条不超过 40 字。',
    '- "encouragement"：一句鼓励语，不超过 40 字。',
    "",
    `本周完成练习：${stats.summary.completedSessions} 次`,
    `本周答题：${stats.summary.answered} 题`,
    `本周正确：${stats.summary.correct} 题`,
    `本周正确率：${stats.summary.accuracy}%`,
    `本周学习时长：${stats.summary.totalMinutes} 分钟`,
    "本周知识点表现（按薄弱程度排序）：",
    knowledgePointLines(stats.knowledgePoints),
    "",
    '只输出 JSON：{"summary":"...","weakPoints":["..."],"nextSteps":["..."],"encouragement":"..."}',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildTeacherClassReportPrompt(stats: LearningStatistics): AiMessage[] {
  const system = "你是一名熟悉中国无线电证书考试的教学分析师，正在帮助教师分析班级学情。只输出 JSON，不要输出任何额外文字。";
  const user = [
    "请根据以下班级统计数据生成教师班级报告，只输出一个 JSON 对象，包含四个字段：",
    '- "overview"：1-2 句话概括班级整体表现，不超过 100 字。',
    '- "weakPoints"：字符串数组，列出全班正确率最低的知识点，每条不超过 30 字。',
    '- "classFocus"：字符串数组，给出下次课堂应重点讲解的知识点或教学建议，2-4 条，每条不超过 40 字。',
    '- "suggestions"：一句教学建议，不超过 50 字。',
    "",
    "统计周期：近 7 天",
    `班级完成练习：${stats.summary.completedSessions} 次`,
    `活跃学生：${stats.summary.activeStudents} 人`,
    `班级答题：${stats.summary.answered} 题`,
    `班级正确：${stats.summary.correct} 题`,
    `班级正确率：${stats.summary.accuracy}%`,
    "全班薄弱知识点 TOP：",
    knowledgePointLines(stats.knowledgePoints),
    "",
    '只输出 JSON：{"overview":"...","weakPoints":["..."],"classFocus":["..."],"suggestions":"..."}',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function extractJsonObject(content: string): JsonObject | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
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

function firstStringArray(obj: JsonObject, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
      if (items.length > 0) return items;
    }
  }
  return [];
}

export function parseStudentReportResponse(content: string): StudentReportContent {
  const trimmed = content.trim();
  const json = extractJsonObject(trimmed);
  if (json) {
    const summary = firstString(json, ["summary", "overview", "总结", "本周表现"]);
    const weakPoints = firstStringArray(json, ["weakPoints", "weak_points", "薄弱点"]);
    const nextSteps = firstStringArray(json, ["nextSteps", "next_steps", "建议", "下一步建议"]);
    const encouragement = firstString(json, ["encouragement", "鼓励", "encourage"]);
    if (summary || weakPoints.length > 0 || nextSteps.length > 0 || encouragement) {
      return { summary, weakPoints, nextSteps, encouragement };
    }
  }
  return { summary: trimmed || "（暂无报告）", weakPoints: [], nextSteps: [], encouragement: "" };
}

export function parseTeacherReportResponse(content: string): TeacherReportContent {
  const trimmed = content.trim();
  const json = extractJsonObject(trimmed);
  if (json) {
    const overview = firstString(json, ["overview", "summary", "总结", "班级表现"]);
    const weakPoints = firstStringArray(json, ["weakPoints", "weak_points", "薄弱点"]);
    const classFocus = firstStringArray(json, ["classFocus", "class_focus", "课堂重点", "建议课堂重点"]);
    const suggestions = firstString(json, ["suggestions", "建议", "suggestion"]);
    if (overview || weakPoints.length > 0 || classFocus.length > 0 || suggestions) {
      return { overview, weakPoints, classFocus, suggestions };
    }
  }
  return { overview: trimmed || "（暂无报告）", weakPoints: [], classFocus: [], suggestions: "" };
}

export type GenerateReportOptions = {
  provider?: AiProvider;
  now?: Date;
  since?: Date;
};

export async function generateStudentWeeklyReport(
  userId: string,
  options: GenerateReportOptions = {},
): Promise<StudentWeeklyReport> {
  const provider = options.provider ?? getAiProvider();
  const now = options.now ?? new Date();
  const since = options.since ?? getDaysAgo(7);
  const stats = await getStudentLearningStatistics(userId, since);
  const messages = buildStudentWeeklyReportPrompt(stats);
  const startedAt = Date.now();
  const completion = await provider.complete(messages, { temperature: 0.4, maxTokens: 700 });
  const latencyMs = Date.now() - startedAt;
  const content = parseStudentReportResponse(completion.content);
  const requestHash = createHash("sha256")
    .update(`student-report:${userId}:${since.toISOString()}`)
    .digest("hex");

  await prisma.aiUsageLog.create({
    data: {
      userId,
      action: STUDENT_WEEKLY_REPORT_ACTION,
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
    generatedAt: now.toISOString(),
    period: { start: since.toISOString(), end: now.toISOString(), label: "近 7 天" },
    summary: stats.summary,
    weakPoints: stats.knowledgePoints,
    content,
    disclaimer: AI_DISCLAIMER,
    model: completion.model,
  };
}

export async function generateTeacherClassReport(
  actorUserId: string,
  options: GenerateReportOptions = {},
): Promise<TeacherClassReport> {
  const provider = options.provider ?? getAiProvider();
  const now = options.now ?? new Date();
  const since = options.since ?? getDaysAgo(7);
  const stats = await getTeacherLearningStatistics(since);
  const messages = buildTeacherClassReportPrompt(stats);
  const startedAt = Date.now();
  const completion = await provider.complete(messages, { temperature: 0.4, maxTokens: 700 });
  const latencyMs = Date.now() - startedAt;
  const content = parseTeacherReportResponse(completion.content);
  const requestHash = createHash("sha256")
    .update(`teacher-report:${since.toISOString()}`)
    .digest("hex");

  await prisma.aiUsageLog.create({
    data: {
      userId: actorUserId,
      action: TEACHER_CLASS_REPORT_ACTION,
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
    generatedAt: now.toISOString(),
    period: { start: since.toISOString(), end: now.toISOString(), label: "近 7 天" },
    summary: stats.summary,
    weakPoints: stats.knowledgePoints,
    content,
    disclaimer: AI_DISCLAIMER,
    model: completion.model,
  };
}
