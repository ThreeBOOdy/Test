import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { revertImportBatch } from "@/lib/server/import-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const result = await revertImportBatch(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "撤销导入失败");
  }
}
