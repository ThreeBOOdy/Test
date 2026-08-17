import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { submitAiTutorFeedback } from "@/lib/server/ai/tutor";

const schema = z.object({
  feedback: z.enum(["HELPFUL", "NOT_HELPFUL"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const result = await submitAiTutorFeedback({
      userId: user.id,
      messageId: id,
      feedback: input.feedback,
    });
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error, "提交 AI 答疑反馈失败");
  }
}
