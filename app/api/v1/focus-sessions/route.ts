import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { getFocusOverview, startFocusSession } from "@/lib/server/focus-service";

const startSchema = z.object({
  targetMinutes: z.number().int().positive().optional(),
  targetQuestionCount: z.number().int().positive().optional(),
}).refine((data) => data.targetMinutes != null || data.targetQuestionCount != null, {
  message: "请设置目标时长或目标题量",
});

export async function GET() {
  try {
    const user = await requireActiveStudent();
    return NextResponse.json(await getFocusOverview(user.id));
  } catch (error) {
    return apiErrorResponse(error, "获取专注状态失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const input = startSchema.parse(await readJsonBody(request));
    return NextResponse.json(await startFocusSession(user.id, input), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "开始专注失败");
  }
}
