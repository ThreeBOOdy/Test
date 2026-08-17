import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  getAiProvider,
  type AiMessage,
  type AiProvider,
} from "@/lib/server/ai/provider";

export const EXPLANATION_ACTION = "EXPLANATION_GENERATE";
export const EXPLANATION_STATUS_NONE = "NONE";
export const EXPLANATION_STATUS_DRAFT = "DRAFT";
export const EXPLANATION_STATUS_APPROVED = "APPROVED";
export const EXPLANATION_STATUS_REJECTED = "REJECTED";

export type ExplanationContent = {
  summary: string;
  knowledge: string;
  memory: string;
};

export type ExplanationQuestion = {
  id: string;
  stem: string;
  options: unknown;
  correctOptionIds: unknown;
  levelName: string;
  knowledgePointName: string;
  type?: string;
  explanationVersion?: number;
};

type JsonObject = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function optionList(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
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

function questionTypeLabel(type: string | undefined): string {
  if (type === "MULTIPLE_CHOICE") return "多选题（可能不止一个正确选项）";
  if (type === "SINGLE_CHOICE") return "单选题";
  return "选择题";
}

export function buildExplanationPrompt(question: ExplanationQuestion): AiMessage[] {
  const optionsText = optionList(question.options).join("\n") || "（无选项）";
  const answerText = correctAnswerText(question.correctOptionIds);
  const system = "你是一名熟悉中国无线电法规、业余无线电考试和对应等级知识点的教学助手。请根据题目生成结构化解析，只输出 JSON，不要输出任何额外文字。";
  const user = [
    "请为以下题目生成解析，只输出一个 JSON 对象，包含三个字段：",
    '- "summary"：一句话解析，说明为什么选这个答案，不超过 80 字。',
    '- "knowledge"：知识点讲解，结合知识点名称展开，不超过 250 字。',
    '- "memory"：记忆点或口诀，不超过 60 字。',
    "",
    `题目等级：${question.levelName}`,
    `知识点：${question.knowledgePointName}`,
    `题型：${questionTypeLabel(question.type)}`,
    "题干：",
    question.stem,
    "选项：",
    optionsText,
    `正确答案：${answerText}`,
    "",
    '只输出 JSON：{"summary":"...","knowledge":"...","memory":"..."}',
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

export function parseExplanationResponse(content: string): ExplanationContent {
  const trimmed = content.trim();
  const json = extractJsonObject(trimmed);
  if (json) {
    const summary = firstString(json, ["summary", "oneSentence", "short", "shortExplanation", "one_sentence", "一句话解析"]);
    const knowledge = firstString(json, ["knowledge", "explanation", "knowledgePoint", "knowledge_point", "detail", "知识点讲解"]);
    const memory = firstString(json, ["memory", "memoryPoint", "memory_point", "mnemonic", "记忆点"]);
    if (summary || knowledge || memory) {
      return { summary, knowledge, memory };
    }
  }
  // 容错：MockProvider 或模型未按 JSON 返回时，把整段内容作为一句话解析保存。
  return { summary: trimmed || "（无解析）", knowledge: "", memory: "" };
}

export function serializeExplanation(content: ExplanationContent): string {
  return JSON.stringify(content);
}

export type GenerateExplanationResult = {
  questionId: string;
  content: ExplanationContent;
  applied: boolean;
};

export async function generateQuestionExplanation(
  question: ExplanationQuestion,
  options: { provider?: AiProvider; now?: Date } = {},
): Promise<GenerateExplanationResult> {
  const provider = options.provider ?? getAiProvider();
  const messages = buildExplanationPrompt(question);
  const startedAt = Date.now();
  const completion = await provider.complete(messages, { temperature: 0.2, maxTokens: 600 });
  const latencyMs = Date.now() - startedAt;
  const content = parseExplanationResponse(completion.content);
  const serialized = serializeExplanation(content);
  const nextVersion = (question.explanationVersion ?? 0) + 1;
  const now = options.now ?? new Date();
  const requestHash = createHash("sha256")
    .update(`explanation:${question.id}:${question.explanationVersion ?? 0}`)
    .digest("hex");

  const [updateResult] = await prisma.$transaction([
    prisma.question.updateMany({
      where: {
        id: question.id,
        explanationStatus: EXPLANATION_STATUS_NONE,
        explanationVersion: question.explanationVersion ?? 0,
      },
      data: {
        explanation: serialized,
        explanationStatus: EXPLANATION_STATUS_DRAFT,
        explanationVersion: nextVersion,
        updatedAt: now,
      },
    }),
    prisma.aiUsageLog.create({
      data: {
        action: EXPLANATION_ACTION,
        provider: provider.name,
        model: completion.model,
        promptTokens: completion.usage?.promptTokens ?? 0,
        completionTokens: completion.usage?.completionTokens ?? 0,
        totalTokens: completion.usage?.totalTokens ?? 0,
        latencyMs,
        requestHash,
      },
    }),
  ]);

  return {
    questionId: question.id,
    content,
    applied: updateResult.count > 0,
  };
}
