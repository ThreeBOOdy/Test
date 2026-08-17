import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { EXPLANATION_REVIEW_ACTIONS, submitExplanationReview } from "@/lib/server/ai/explanation-review";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";

const contentSchema = z.object({
  summary: z.string().trim().min(1).max(5000),
  knowledge: z.string().trim().max(10000).default(""),
  memory: z.string().trim().max(2000).default(""),
});

const reviewSchema = z
  .object({
    action: z.enum(EXPLANATION_REVIEW_ACTIONS),
    content: contentSchema.optional(),
    rejectReason: z.string().trim().max(1000).optional(),
    version: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "APPROVE_WITH_EDITS" && !value.content) {
      ctx.addIssue({ code: "custom", message: "修改后通过需要提交修改后的解析内容", path: ["content"] });
    }
  });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = reviewSchema.parse(await readJsonBody(request));
    const result = await submitExplanationReview({
      questionId: id,
      actorUserId: user.id,
      action: input.action,
      content: input.content,
      rejectReason: input.rejectReason,
      version: input.version,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "提交 AI 解析审核失败");
  }
}
