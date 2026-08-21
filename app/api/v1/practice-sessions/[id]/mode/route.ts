import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { updatePracticeSessionLearningMode } from "@/lib/server/practice-service";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";

const schema = z.object({
  learningMode: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await updatePracticeSessionLearningMode(user.id, id, input.learningMode));
  } catch (error) {
    return apiErrorResponse(error, "切换学习模式失败");
  }
}
