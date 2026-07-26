import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

const createGradeSchema = z.object({
  code: z.string().trim().min(1, "请输入年级代码").max(50, "年级代码不能超过 50 个字符"),
  name: z.string().trim().min(1, "请输入年级名称").max(100, "年级名称不能超过 100 个字符"),
  sortOrder: z.number().int().min(0).max(100000),
  enabled: z.boolean(),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET() {
  try {
    await requireAdministrator();
    const grades = await prisma.grade.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json({
      grades: grades.map((grade) => ({
        id: grade.id,
        code: grade.code,
        name: grade.name,
        sortOrder: grade.sortOrder,
        enabled: grade.enabled,
        updatedAt: grade.updatedAt.toISOString(),
        studentCount: grade._count.students,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "读取年级失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAdministrator();
    const input = createGradeSchema.parse(await readJsonBody(request));
    const grade = await prisma.grade.create({ data: input });
    await writeAuditLog({ actorUserId: user.id, action: "GRADE_CREATE", targetType: "Grade", targetId: grade.id, metadata: { code: input.code } });
    return NextResponse.json({ id: grade.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("年级代码或名称已存在", 409), "创建年级失败");
    return apiErrorResponse(error, "创建年级失败");
  }
}
