import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireRole } from "@/lib/server/api";

const schema = z.object({ name: z.string().trim().min(1).max(200), sortOrder: z.number().int().min(0).max(100000), enabled: z.boolean() });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("TEACHER");
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const point = await prisma.knowledgePoint.findUnique({ where: { id } });
    if (!point) throw new ApiError("知识点不存在", 404);
    await prisma.$transaction([
      prisma.knowledgePoint.update({ where: { id }, data: { name: input.name, sortOrder: input.sortOrder } }),
      prisma.knowledgePoint.updateMany({
        where: { OR: [{ id }, { path: { startsWith: `${point.path}/` } }] },
        data: { enabled: input.enabled },
      }),
    ]);
    await writeAuditLog({ actorUserId: user.id, action: "KNOWLEDGE_UPDATE", targetType: "KnowledgePoint", targetId: id, metadata: { enabled: input.enabled } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "更新知识点失败");
  }
}
