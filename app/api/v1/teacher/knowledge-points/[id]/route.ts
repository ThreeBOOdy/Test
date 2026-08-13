import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { STALE_VERSION_MESSAGE } from "@/lib/server/question-revisions";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";

const schema = z.object({ name: z.string().trim().min(1).max(200), sortOrder: z.number().int().min(0).max(100000), enabled: z.boolean(), version: z.number().int().positive() });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const saved = await prisma.$transaction(async (tx) => {
      const point = await tx.knowledgePoint.findFirst({ where: { id } });
      if (!point) throw new ApiError("知识点不存在", 404);
      const changed = await tx.knowledgePoint.updateMany({ where: { id, version: input.version }, data: { name: input.name, sortOrder: input.sortOrder, enabled: input.enabled, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
      await tx.knowledgePoint.updateMany({ where: { path: { startsWith: `${point.path}/` } }, data: { enabled: input.enabled, version: { increment: 1 } } });
      const updated = await tx.knowledgePoint.findFirstOrThrow({ where: { id } });
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "KNOWLEDGE_UPDATE", targetType: "KnowledgePoint", targetId: id, metadata: { enabled: input.enabled, version: updated.version } });
      return updated;
    });
    return NextResponse.json({ saved: true, version: saved.version });
  } catch (error) {
    return apiErrorResponse(error, "更新知识点失败");
  }
}
