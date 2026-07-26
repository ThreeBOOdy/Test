import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { normalizeKnowledgeCode } from "@/lib/domain/knowledge-code";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireTeachingUser } from "@/lib/server/api";

const schema = z.object({ code: z.string(), name: z.string().trim().min(1).max(200), sortOrder: z.number().int().min(0).max(100000).default(0) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeachingUser();
    const input = schema.parse(await readJsonBody(request));
    const code = normalizeKnowledgeCode(input.code);
    const existing = await prisma.knowledgePoint.findUnique({ where: { code } });
    if (existing) throw new ApiError("分类号已存在", 409);
    const point = await prisma.$transaction((tx) => ensureKnowledgePoint(tx, code, input.name, input.sortOrder));
    await writeAuditLog({ actorUserId: user.id, action: "KNOWLEDGE_CREATE", targetType: "KnowledgePoint", targetId: point.id });
    return NextResponse.json({ id: point.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "创建知识点失败");
  }
}
