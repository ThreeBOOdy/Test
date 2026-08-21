import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { deleteExamBlueprint, getExamBlueprint, updateExamBlueprint } from "@/lib/server/exam-blueprint-service";
import { examBlueprintItemSchema } from "../route";

const updateBlueprintSchema = z.object({
  name: z.string().trim().min(1, "请输入蓝图名称").max(100, "蓝图名称不能超过 100 个字符"),
  durationMinutes: z.number().int().min(1, "考试时间必须大于 0 分钟").max(1440, "考试时间不能超过 1440 分钟").nullable().optional(),
  passingCount: z.number().int().min(1, "合格题数必须大于 0").max(1000, "合格题数不能超过 1000"),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  items: z.array(examBlueprintItemSchema).min(1, "蓝图至少需要一个条目"),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireTeacher();
    const { id } = await context.params;
    const blueprint = await getExamBlueprint(id);
    if (!blueprint) throw new ApiError("蓝图不存在", 404);
    return NextResponse.json({ blueprint });
  } catch (error) {
    return apiErrorResponse(error, "读取蓝图失败");
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = updateBlueprintSchema.parse(await readJsonBody(request));
    const blueprint = await updateExamBlueprint(user.id, id, {
      name: input.name,
      durationMinutes: input.durationMinutes ?? null,
      passingCount: input.passingCount,
      enabled: input.enabled,
      isDefault: input.isDefault,
      items: input.items,
    });
    return NextResponse.json({ saved: true, id: blueprint.id });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("蓝图名称已存在", 409), "更新蓝图失败");
    return apiErrorResponse(error, "更新蓝图失败");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTeacher();
    const { id } = await context.params;
    const result = await deleteExamBlueprint(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "删除蓝图失败");
  }
}
