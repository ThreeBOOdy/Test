import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const type = await prisma.knowledgePointType.findUnique({ where: { id }, select: { id: true, enabled: true } });
    if (!type) throw new ApiError("知识点类型不存在", 404);
    if (!type.enabled) return NextResponse.json({ saved: true });
    await prisma.knowledgePointType.update({ where: { id }, data: { enabled: false } });
    await writeAuditLog({ actorUserId: user.id, action: "KNOWLEDGE_POINT_TYPE_DISABLE", targetType: "KnowledgePointType", targetId: id, metadata: { enabled: false } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "停用知识点类型失败");
  }
}
