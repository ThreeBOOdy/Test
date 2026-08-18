import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { removeQuestionLevels } from "@/lib/server/question-level-service";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

const schema = z.object({
  levelIds: z.array(z.string().min(1)).min(1, "请选择至少一个字母类").max(1000, "单次最多 1000 个字母类"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const result = await removeQuestionLevels(user.id, [id], input.levelIds);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "取消字母类失败");
  }
}
