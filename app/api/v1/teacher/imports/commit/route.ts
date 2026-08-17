import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { commitImportBatch } from "@/lib/server/import-service";

const schema = z.object({ batchId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { batchId } = schema.parse(await readJsonBody(request));
    const result = await commitImportBatch(user.id, batchId);
    await writeAuditLog({ actorUserId: user.id, action: "IMPORT_COMMIT", targetType: "ImportBatch", targetId: batchId, metadata: { inserted: result.inserted, skipped: result.skipped } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "导入失败");
  }
}
