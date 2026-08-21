import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { addExamBlueprintItem, getExamBlueprint } from "@/lib/server/exam-blueprint-service";
import { examBlueprintItemSchema } from "../../route";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireTeacher();
    const { id } = await context.params;
    const blueprint = await getExamBlueprint(id);
    if (!blueprint) throw new ApiError("蓝图不存在", 404);
    return NextResponse.json({ items: blueprint.items });
  } catch (error) {
    return apiErrorResponse(error, "读取蓝图条目失败");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const item = examBlueprintItemSchema.parse(await readJsonBody(request));
    const created = await addExamBlueprintItem(user.id, id, item);
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "添加蓝图条目失败");
  }
}
