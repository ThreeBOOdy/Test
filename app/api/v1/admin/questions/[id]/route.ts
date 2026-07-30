import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeQuestionEditorInput } from "@/lib/domain/question-editor";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireTeachingUser } from "@/lib/server/api";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

const schema = z.object({
  levelId: z.string().min(1),
  knowledgePointId: z.string().min(1),
  sourceBankCode: z.string().trim().max(100).optional(),
  externalQuestionCode: z.string().trim().max(100).optional(),
  stem: z.string().trim().min(1).max(5000),
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2).max(8),
  correctOptionIds: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeachingUser();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const normalized = normalizeQuestionEditorInput(input);
    const [question, level, point] = await Promise.all([
      prisma.question.findFirst({ where: { id, courseId: RADIO_COURSE_ID } }),
      prisma.level.findFirst({ where: { id: input.levelId, courseId: RADIO_COURSE_ID } }),
      prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, courseId: RADIO_COURSE_ID }, include: { _count: { select: { children: true } } } }),
    ]);
    if (!question) throw new ApiError("题目不存在", 404);
    if (!level || (!level.enabled && input.levelId !== question.levelId)) throw new ApiError("等级不存在或已停用", 404);
    if (!point || (!point.enabled && input.knowledgePointId !== question.knowledgePointId)) throw new ApiError("知识点不存在或已停用", 404);
    if (point._count.children > 0) throw new ApiError("题目必须归属末级知识点");
    if (input.externalQuestionCode) {
      const duplicate = await prisma.question.findFirst({ where: { id: { not: id }, courseId: RADIO_COURSE_ID, levelId: input.levelId, externalQuestionCode: input.externalQuestionCode } });
      if (duplicate) throw new ApiError("该等级下已存在相同题目编号", 409);
    }
    await prisma.question.update({
      where: { id },
      data: {
        levelId: input.levelId,
        knowledgePointId: input.knowledgePointId,
        sourceBankCode: input.sourceBankCode || null,
        externalQuestionCode: input.externalQuestionCode || null,
        stem: input.stem,
        type: normalized.type,
        optionCount: normalized.optionCount,
        correctOptionCount: normalized.correctOptionCount,
        selectionSpec: normalized.selectionSpec,
        options: normalized.options as Prisma.InputJsonValue,
        correctOptionIds: normalized.correctOptionIds as Prisma.InputJsonValue,
        status: input.status,
      },
    });
    await writeAuditLog({ actorUserId: user.id, action: "QUESTION_UPDATE", targetType: "Question", targetId: id, metadata: { status: input.status } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "更新题目失败");
  }
}
