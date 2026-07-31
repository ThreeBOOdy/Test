import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeQuestionEditorInput } from "@/lib/domain/question-editor";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { STALE_VERSION_MESSAGE, toQuestionSnapshot } from "@/lib/server/question-revisions";
import { questionInputSchema } from "@/app/api/v1/teacher/questions/route";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

const schema = questionInputSchema.extend({ version: z.number().int().positive() });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const normalized = normalizeQuestionEditorInput(input);
    const [question, level, point] = await Promise.all([
      prisma.question.findFirst({ where: { id, courseId: RADIO_COURSE_ID } }),
      prisma.level.findFirst({ where: { id: input.levelId, courseId: RADIO_COURSE_ID } }),
      prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, courseId: RADIO_COURSE_ID }, include: { _count: { select: { children: true } } } }),
    ]);
    if (!question) throw new ApiError("题目不存在", 404);
    if (question.status === "ARCHIVED") throw new ApiError("归档题目必须通过修订历史恢复", 409);
    if (!level || (!level.enabled && input.levelId !== question.levelId)) throw new ApiError("等级不存在或已停用", 404);
    if (!point || (!point.enabled && input.knowledgePointId !== question.knowledgePointId)) throw new ApiError("知识点不存在或已停用", 404);
    if (point._count.children > 0) throw new ApiError("题目必须归属末级知识点");
    const saved = await prisma.$transaction(async (tx) => {
      if (input.externalQuestionCode) {
        const duplicate = await tx.question.findFirst({ where: { id: { not: id }, courseId: RADIO_COURSE_ID, levelId: input.levelId, externalQuestionCode: input.externalQuestionCode } });
        if (duplicate) throw new ApiError("该等级下已存在相同题目编号", 409);
      }
      const changed = await tx.question.updateMany({
        where: { id, courseId: RADIO_COURSE_ID, version: input.version },
        data: { levelId: input.levelId, knowledgePointId: input.knowledgePointId, sourceBankCode: input.sourceBankCode || null, externalQuestionCode: input.externalQuestionCode || null, stem: input.stem, type: normalized.type, optionCount: normalized.optionCount, correctOptionCount: normalized.correctOptionCount, selectionSpec: normalized.selectionSpec, preserveOptionOrder: input.preserveOptionOrder, options: normalized.options as Prisma.InputJsonValue, correctOptionIds: normalized.correctOptionIds as Prisma.InputJsonValue, status: input.status, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
      const updated = await tx.question.findFirstOrThrow({ where: { id, courseId: RADIO_COURSE_ID } });
      await tx.questionRevision.create({ data: { courseId: RADIO_COURSE_ID, questionId: id, revision: updated.version, snapshot: toQuestionSnapshot(updated), changeSource: "TEACHER_UPDATE", actorUserId: user.id } });
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "QUESTION_UPDATE", targetType: "Question", targetId: id, metadata: { status: input.status, version: updated.version } });
      return updated;
    });
    return NextResponse.json({ saved: true, version: saved.version });
  } catch (error) {
    return apiErrorResponse(error, "更新题目失败");
  }
}
