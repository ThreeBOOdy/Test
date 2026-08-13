import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeQuestionEditorInput } from "@/lib/domain/question-editor";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { toQuestionSnapshot } from "@/lib/server/question-revisions";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";

export const questionInputSchema = z.object({
  levelId: z.string().min(1),
  knowledgePointId: z.string().min(1),
  sourceBankCode: z.string().trim().max(100).optional(),
  externalQuestionCode: z.string().trim().max(100).optional(),
  stem: z.string().trim().min(1).max(5000),
  preserveOptionOrder: z.boolean().default(false),
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2).max(8),
  correctOptionIds: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).default("ACTIVE"),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = questionInputSchema.parse(await readJsonBody(request));
    const normalized = normalizeQuestionEditorInput(input);
    const [level, point] = await Promise.all([
      prisma.level.findFirst({ where: { id: input.levelId, enabled: true } }),
      prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, enabled: true }, include: { _count: { select: { children: true } } } }),
    ]);
    if (!level) throw new ApiError("等级不存在或已停用", 404);
    if (!point) throw new ApiError("知识点不存在或已停用", 404);
    if (point._count.children > 0) throw new ApiError("题目必须归属末级知识点");
    const question = await prisma.$transaction(async (tx) => {
      if (input.externalQuestionCode) {
        const duplicate = await tx.question.findFirst({ where: { levelId: input.levelId, externalQuestionCode: input.externalQuestionCode } });
        if (duplicate) throw new ApiError("该等级下已存在相同题目编号", 409);
      }
      const created = await tx.question.create({
        data: {
          levelId: input.levelId, knowledgePointId: input.knowledgePointId,
          sourceBankCode: input.sourceBankCode || null, externalQuestionCode: input.externalQuestionCode || null, stem: input.stem,
          type: normalized.type, optionCount: normalized.optionCount, correctOptionCount: normalized.correctOptionCount, selectionSpec: normalized.selectionSpec, preserveOptionOrder: input.preserveOptionOrder,
          options: normalized.options as Prisma.InputJsonValue, correctOptionIds: normalized.correctOptionIds as Prisma.InputJsonValue, status: input.status,
        },
      });
      await tx.questionRevision.create({ data: { questionId: created.id, revision: created.version, snapshot: toQuestionSnapshot(created), changeSource: "TEACHER_CREATE", actorUserId: user.id } });
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "QUESTION_CREATE", targetType: "Question", targetId: created.id, metadata: { version: created.version } });
      return created;
    });
    return NextResponse.json({ id: question.id, version: question.version }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "创建题目失败");
  }
}
