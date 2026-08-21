import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { deleteExamBlueprintItem, updateExamBlueprintItem } from "@/lib/server/exam-blueprint-service";
import { examBlueprintItemSchema } from "../../../route";

export async function PUT(request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id, itemId } = await context.params;
    const item = examBlueprintItemSchema.parse(await readJsonBody(request));
    const updated = await updateExamBlueprintItem(user.id, id, itemId, item);
    return NextResponse.json({ saved: true, id: updated.id });
  } catch (error) {
    return apiErrorResponse(error, "更新蓝图条目失败");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const user = await requireTeacher();
    const { id, itemId } = await context.params;
    const result = await deleteExamBlueprintItem(user.id, id, itemId);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "删除蓝图条目失败");
  }
}
