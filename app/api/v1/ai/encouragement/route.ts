import { NextResponse } from "next/server";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { generateDailyEncouragement } from "@/lib/server/ai/gamification";

export async function GET() {
  try {
    const user = await requireActiveStudent();
    try {
      return NextResponse.json(await generateDailyEncouragement(user.id));
    } catch {
      return NextResponse.json({
        text: "今天也保持稳定输出，把每个知识点都变成自己的信号。",
        model: "fallback",
        generatedAt: new Date().toISOString(),
        disclaimer: "AI 生成，仅供参考",
      });
    }
  } catch (error) {
    return apiErrorResponse(error, "获取今日鼓励失败");
  }
}
