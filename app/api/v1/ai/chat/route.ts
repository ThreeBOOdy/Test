import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import type { AiProvider } from "@/lib/server/ai/provider";
import {
  prepareAiTutorChat,
  recordAiTutorAssistantMessage,
} from "@/lib/server/ai/tutor";

const schema = z.object({
  conversationId: z.string().trim().max(100).optional(),
  questionId: z.string().trim().min(1).max(100),
  practiceSessionId: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1).max(2000),
});

function streamModelName(provider: AiProvider) {
  if (provider.name === "mock") return "mock-model";
  return process.env.AI_MODEL?.trim() || "stream";
}

function encodeSse(event: string, data: unknown) {
  const encoder = new TextEncoder();
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const input = schema.parse(await readJsonBody(request));

    const prepared = await prepareAiTutorChat({
      userId: user.id,
      conversationId: input.conversationId,
      questionId: input.questionId,
      practiceSessionId: input.practiceSessionId,
      message: input.message,
    });

    const startedAt = Date.now();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encodeSse("meta", {
          conversationId: prepared.conversationId,
          isFollowUp: prepared.isFollowUp,
        }));
        let fullContent = "";
        try {
          for await (const delta of prepared.provider.stream(prepared.messages, {
            signal: request.signal,
            temperature: 0.3,
            maxTokens: 800,
          })) {
            if (delta.content) {
              fullContent += delta.content;
              controller.enqueue(encodeSse("delta", { content: delta.content }));
            }
          }
          const saved = await recordAiTutorAssistantMessage({
            conversationId: prepared.conversationId,
            userId: user.id,
            questionId: prepared.questionId,
            content: fullContent,
            provider: prepared.provider.name,
            model: streamModelName(prepared.provider),
            latencyMs: Date.now() - startedAt,
          });
          controller.enqueue(encodeSse("done", {
            conversationId: prepared.conversationId,
            messageId: saved.id,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI 答疑服务暂时不可用";
          controller.enqueue(encodeSse("error", { message }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "发起 AI 答疑失败");
  }
}
