import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { copyExamBlueprint } from "@/lib/server/exam-blueprint-service";

const copyBlueprintSchema = z.object({
  name: z.string().trim().min(1, "请输入蓝图名称").max(100, "蓝图名称不能超过 100 个字符").optional(),
  levelId: z.string().min(1, "请选择字母类").optional(),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = copyBlueprintSchema.parse(await readJsonBody(request));
    const blueprint = await copyExamBlueprint(user.id, id, input);
    return NextResponse.json({ id: blueprint.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("蓝图名称已存在", 409), "复制蓝图失败");
    return apiErrorResponse(error, "复制蓝图失败");
  }
}
