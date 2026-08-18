import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { normalizeKnowledgeCode } from "@/lib/domain/knowledge-code";
import { ensureKnowledgePoint, getOrCreateDefaultKnowledgePointType } from "@/lib/server/knowledge-service";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";

const schema = z.object({
  code: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  typeId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireTeacher();
    const url = new URL(request.url);
    const typeId = url.searchParams.get("typeId") || undefined;
    if (typeId) {
      const type = await prisma.knowledgePointType.findUnique({ where: { id: typeId }, select: { id: true } });
      if (!type) throw new ApiError("知识点类型不存在", 404);
    }
    const points = await prisma.knowledgePoint.findMany({
      where: typeId ? { typeId } : undefined,
      include: {
        type: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true, questions: true } },
      },
      orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json({
      typeId: typeId ?? null,
      points: points.map((point) => ({
        id: point.id,
        typeId: point.typeId,
        type: point.type,
        code: point.code,
        name: point.name,
        path: point.path,
        depth: point.depth,
        sortOrder: point.sortOrder,
        enabled: point.enabled,
        version: point.version,
        childCount: point._count.children,
        questionCount: point._count.questions,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "读取知识点失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = schema.parse(await readJsonBody(request));
    const code = normalizeKnowledgeCode(input.code);
    const point = await prisma.$transaction(async (tx) => {
      let typeId = input.typeId;
      if (typeId) {
        const type = await tx.knowledgePointType.findUnique({ where: { id: typeId }, select: { id: true, enabled: true } });
        if (!type) throw new ApiError("知识点类型不存在", 404);
        if (!type.enabled) throw new ApiError("知识点类型已停用", 409);
      } else {
        const type = await getOrCreateDefaultKnowledgePointType(tx);
        typeId = type.id;
      }
      const existing = await tx.knowledgePoint.findFirst({ where: { typeId, code } });
      if (existing) throw new ApiError("分类号已存在", 409);
      const created = await ensureKnowledgePoint(tx, code, input.name, input.sortOrder, typeId);
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "KNOWLEDGE_CREATE", targetType: "KnowledgePoint", targetId: created.id, metadata: { typeId, version: created.version } });
      return created;
    });
    return NextResponse.json({ id: point.id, typeId: point.typeId, version: point.version }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "创建知识点失败");
  }
}
