import { NextResponse } from "next/server";
import { getExplanationReviewDetail } from "@/lib/server/ai/explanation-review";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireTeacher();
    const { id } = await context.params;
    return NextResponse.json(await getExplanationReviewDetail(id));
  } catch (error) {
    return apiErrorResponse(error, "读取 AI 解析详情失败");
  }
}
