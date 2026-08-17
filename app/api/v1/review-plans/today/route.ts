import { NextResponse } from "next/server";
import { getTodayReviewPlan } from "@/lib/server/review-plan-service";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";

export async function GET() {
  try {
    const user = await requireActiveStudent();
    return NextResponse.json(await getTodayReviewPlan(user.id));
  } catch (error) {
    return apiErrorResponse(error, "读取今日复习计划失败");
  }
}
