import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

const updateLevelSchema = z.object({
  name: z.string().trim().min(1, "请输入字母类名称").max(100, "字母类名称不能超过 100 个字符"),
  sortOrder: z.number().int().min(0).max(100000),
  enabled: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = updateLevelSchema.parse(await readJsonBody(request));
    const level = await prisma.level.findUnique({ where: { id }, select: { id: true } });
    if (!level) throw new ApiError("字母类不存在", 404);
    const result = await prisma.level.updateMany({
      where: { id, updatedAt: new Date(input.updatedAt) },
      data: { name: input.name, sortOrder: input.sortOrder, enabled: input.enabled },
    });
    if (result.count !== 1) throw new ApiError("字母类已被其他教师修改，请刷新后重试", 409);
    await writeAuditLog({ actorUserId: user.id, action: "LEVEL_UPDATE", targetType: "Level", targetId: id, metadata: { enabled: input.enabled, sortOrder: input.sortOrder } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "更新字母类失败");
  }
}
