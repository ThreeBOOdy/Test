import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { isKnowledgePointTypeCode, normalizeKnowledgePointTypeCode } from "@/lib/domain/knowledge-point-type-code";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

const createKnowledgePointTypeSchema = z.object({
  code: z.string().trim().min(1, "请输入知识点类型代码").max(50, "知识点类型代码不能超过 50 个字符").refine(isKnowledgePointTypeCode, { message: "知识点类型代码只能包含字母、数字、横线和下划线（如 DG、TX）" }),
  name: z.string().trim().min(1, "请输入知识点类型名称").max(100, "知识点类型名称不能超过 100 个字符"),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  enabled: z.boolean().default(true),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET() {
  try {
    await requireTeacher();
    const types = await prisma.knowledgePointType.findMany({
      include: { _count: { select: { points: true } } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json({
      types: types.map((type) => ({
        id: type.id,
        code: type.code,
        name: type.name,
        sortOrder: type.sortOrder,
        enabled: type.enabled,
        updatedAt: type.updatedAt.toISOString(),
        pointCount: type._count.points,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "读取知识点类型失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = createKnowledgePointTypeSchema.parse(await readJsonBody(request));
    const code = normalizeKnowledgePointTypeCode(input.code);
    const type = await prisma.knowledgePointType.create({
      data: { code, name: input.name, sortOrder: input.sortOrder, enabled: input.enabled },
    });
    await writeAuditLog({ actorUserId: user.id, action: "KNOWLEDGE_POINT_TYPE_CREATE", targetType: "KnowledgePointType", targetId: type.id, metadata: { code, enabled: input.enabled } });
    return NextResponse.json({ id: type.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("知识点类型代码已存在", 409), "创建知识点类型失败");
    return apiErrorResponse(error, "创建知识点类型失败");
  }
}
