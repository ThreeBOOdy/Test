import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { completeFocusSession } from "@/lib/server/focus-service";

const completeSchema = z.object({
  completed: z.boolean(),
  actualQuestionCount: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    const input = completeSchema.parse(await readJsonBody(request));
    return NextResponse.json(await completeFocusSession(user.id, id, input));
  } catch (error) {
    return apiErrorResponse(error, "结束专注失败");
  }
}
