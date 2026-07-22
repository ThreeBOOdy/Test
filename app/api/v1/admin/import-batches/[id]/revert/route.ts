import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { apiErrorResponse, requireRole } from "@/lib/server/api";
import { revertImportBatch } from "@/lib/server/import-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("TEACHER");
    const { id } = await context.params;
    const result = await revertImportBatch(id);
    await writeAuditLog({ actorUserId: user.id, action: "IMPORT_REVERT", targetType: "ImportBatch", targetId: id, metadata: result });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "撤销导入失败");
  }
}
