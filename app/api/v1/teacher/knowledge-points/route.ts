import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { normalizeKnowledgeCode } from "@/lib/domain/knowledge-code";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

const schema = z.object({ code: z.string(), name: z.string().trim().min(1).max(200), sortOrder: z.number().int().min(0).max(100000).default(0) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = schema.parse(await readJsonBody(request));
    const code = normalizeKnowledgeCode(input.code);
    const point = await prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgePoint.findUnique({ where: { courseId_code: { courseId: RADIO_COURSE_ID, code } } });
      if (existing) throw new ApiError("分类号已存在", 409);
      const created = await ensureKnowledgePoint(tx, code, input.name, input.sortOrder);
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "KNOWLEDGE_CREATE", targetType: "KnowledgePoint", targetId: created.id, metadata: { version: created.version } });
      return created;
    });
    return NextResponse.json({ id: point.id, version: point.version }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "创建知识点失败");
  }
}
