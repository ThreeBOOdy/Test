import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { assignQuestionLevels } from "@/lib/server/question-level-service";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

const schema = z.object({
  questionIds: z.array(z.string().min(1)).min(1, "请选择至少一道题").max(500, "单次最多 500 道题"),
  levelIds: z.array(z.string().min(1)).min(1, "请选择至少一个字母类").max(1000, "单次最多 1000 个字母类"),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = schema.parse(await readJsonBody(request));
    const result = await assignQuestionLevels(user.id, input.questionIds, input.levelIds);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "批量拉取字母类失败");
  }
}
