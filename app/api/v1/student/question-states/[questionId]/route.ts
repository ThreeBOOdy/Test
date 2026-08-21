import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { setStudentQuestionState } from "@/lib/server/student-question-state-service";

const schema = z
  .object({
    favorite: z.boolean().optional(),
    ignored: z.boolean().optional(),
  })
  .strict()
  .refine((input) => input.favorite !== undefined || input.ignored !== undefined, {
    message: "至少提供 favorite 或 ignored 字段",
  });

export async function PATCH(request: Request, context: { params: Promise<{ questionId: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { questionId } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await setStudentQuestionState(user.id, questionId, input));
  } catch (error) {
    return apiErrorResponse(error, "更新题目状态失败");
  }
}
