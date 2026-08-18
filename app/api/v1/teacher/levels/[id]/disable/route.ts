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
    const level = await prisma.level.findUnique({ where: { id }, select: { id: true, enabled: true } });
    if (!level) throw new ApiError("字母类不存在", 404);
    if (!level.enabled) return NextResponse.json({ saved: true });
    await prisma.level.update({ where: { id }, data: { enabled: false } });
    await writeAuditLog({ actorUserId: user.id, action: "LEVEL_DISABLE", targetType: "Level", targetId: id, metadata: { enabled: false } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "停用字母类失败");
  }
}
