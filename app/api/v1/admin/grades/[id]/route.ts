import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

const updateGradeSchema = z.object({
  name: z.string().trim().min(1, "请输入年级名称").max(100, "年级名称不能超过 100 个字符"),
  sortOrder: z.number().int().min(0).max(100000),
  enabled: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAdministrator();
    const { id } = await context.params;
    const input = updateGradeSchema.parse(await readJsonBody(request));
    const grade = await prisma.grade.findUnique({ where: { id }, select: { id: true } });
    if (!grade) throw new ApiError("年级不存在", 404);
    const result = await prisma.grade.updateMany({
      where: { id, updatedAt: new Date(input.updatedAt) },
      data: { name: input.name, sortOrder: input.sortOrder, enabled: input.enabled },
    });
    if (result.count !== 1) throw new ApiError("年级已被其他管理员修改，请刷新后重试", 409);
    await writeAuditLog({ actorUserId: user.id, action: "GRADE_UPDATE", targetType: "Grade", targetId: id, metadata: { enabled: input.enabled, sortOrder: input.sortOrder } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("年级名称已存在", 409), "更新年级失败");
    return apiErrorResponse(error, "更新年级失败");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requireAdministrator();
    const { id } = await context.params;
    const grade = await prisma.grade.findUnique({ where: { id }, select: { id: true, _count: { select: { students: true } } } });
    if (!grade) throw new ApiError("年级不存在", 404);
    if (grade._count.students > 0) throw new ApiError("该年级已有学生使用，不能删除，请改为停用", 409);
    throw new ApiError("年级配置不支持删除，请改为停用", 409);
  } catch (error) {
    return apiErrorResponse(error, "删除年级失败");
  }
}
