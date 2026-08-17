import { NextResponse } from "next/server";
import { completeReviewCard } from "@/lib/server/review-plan-service";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ planId: string; cardId: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { planId, cardId } = await context.params;
    return NextResponse.json(await completeReviewCard(user.id, planId, cardId));
  } catch (error) {
    return apiErrorResponse(error, "完成复习任务失败");
  }
}
