import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

const updateKnowledgePointTypeSchema = z.object({
  name: z.string().trim().min(1, "请输入知识点类型名称").max(100, "知识点类型名称不能超过 100 个字符"),
  sortOrder: z.number().int().min(0).max(100000),
  enabled: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = updateKnowledgePointTypeSchema.parse(await readJsonBody(request));
    const type = await prisma.knowledgePointType.findUnique({ where: { id }, select: { id: true } });
    if (!type) throw new ApiError("知识点类型不存在", 404);
    const result = await prisma.knowledgePointType.updateMany({
      where: { id, updatedAt: new Date(input.updatedAt) },
      data: { name: input.name, sortOrder: input.sortOrder, enabled: input.enabled },
    });
    if (result.count !== 1) throw new ApiError("知识点类型已被其他教师修改，请刷新后重试", 409);
    await writeAuditLog({ actorUserId: user.id, action: "KNOWLEDGE_POINT_TYPE_UPDATE", targetType: "KnowledgePointType", targetId: id, metadata: { enabled: input.enabled, sortOrder: input.sortOrder } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "更新知识点类型失败");
  }
}
