import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { submitPracticeAnswer } from "@/lib/server/practice-service";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";

const schema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).min(1),
  idempotencyKey: z.string().trim().min(1, "缺少答题请求标识").max(128),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await submitPracticeAnswer(user.id, id, input.questionId, input.selectedOptionIds, input.idempotencyKey));
  } catch (error) {
    return apiErrorResponse(error, "提交答案失败");
  }
}
