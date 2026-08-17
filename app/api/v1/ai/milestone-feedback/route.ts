import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { generateMilestoneFeedback } from "@/lib/server/ai/gamification";
import { assertSameOrigin } from "@/lib/server/http";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("LEVEL_UP"), level: z.number().int().positive(), title: z.string() }),
  z.object({ type: z.literal("QUEST_COMPLETE"), questTitle: z.string(), xpReward: z.number().int() }),
  z.object({ type: z.literal("BOSS_CLEAR"), correct: z.number().int().nonnegative(), total: z.number().int().positive(), passed: z.boolean() }),
]);

function fallbackForEvent(event: z.infer<typeof schema>): string {
  if (event.type === "LEVEL_UP") return `恭喜升到 Lv.${event.level} ${event.title}，继续保持！`;
  if (event.type === "QUEST_COMPLETE") return `完成了「${event.questTitle}」，+${event.xpReward} XP，干得漂亮！`;
  return event.passed ? "Boss 已被击败，你的努力转化成了胜利！" : "Boss 还在前方，但你已经比上一次更强了！";
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const input = schema.parse(await readJsonBody(request));
    try {
      return NextResponse.json(await generateMilestoneFeedback(user.id, input));
    } catch {
      return NextResponse.json({
        text: fallbackForEvent(input),
        model: "fallback",
        generatedAt: new Date().toISOString(),
        disclaimer: "AI 生成，仅供参考",
      });
    }
  } catch (error) {
    return apiErrorResponse(error, "生成里程碑反馈失败");
  }
}
