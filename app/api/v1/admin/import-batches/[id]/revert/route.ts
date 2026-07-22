import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireRole } from "@/lib/server/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("TEACHER");
    const { id } = await context.params;
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({ where: { id } });
      if (!batch) throw new ApiError("导入批次不存在", 404);
      if (batch.status !== "COMMITTED") throw new ApiError("只有已提交批次可以撤销", 409);
      const used = await tx.question.updateMany({ where: { importBatchId: id, sessionQuestions: { some: {} } }, data: { status: "ARCHIVED" } });
      const removed = await tx.question.deleteMany({ where: { importBatchId: id, sessionQuestions: { none: {} }, answers: { none: {} }, wrongQuestions: { none: {} } } });
      await tx.importBatch.update({ where: { id }, data: { status: "REVERTED", revertedAt: new Date() } });
      return { archived: used.count, deleted: removed.count };
    });
    await writeAuditLog({ actorUserId: user.id, action: "IMPORT_REVERT", targetType: "ImportBatch", targetId: id, metadata: result });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "撤销导入失败");
  }
}
