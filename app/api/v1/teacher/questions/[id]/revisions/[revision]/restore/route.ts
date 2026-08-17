import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeQuestionEditorInput } from "@/lib/domain/question-editor";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { parseQuestionRevisionSnapshot, STALE_VERSION_MESSAGE, toQuestionSnapshot } from "@/lib/server/question-revisions";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";

const schema = z.object({ version: z.number().int().positive() });

export async function POST(request: Request, context: { params: Promise<{ id: string; revision: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id, revision: revisionText } = await context.params;
    const revision = z.coerce.number().int().positive().parse(revisionText);
    const { version } = schema.parse(await readJsonBody(request));
    const restored = await prisma.$transaction(async (tx) => {
      const historical = await tx.questionRevision.findFirst({ where: { questionId: id, revision } });
      if (!historical) throw new ApiError("题目修订不存在", 404);
      const snapshot = parseQuestionRevisionSnapshot(historical.snapshot);
      const normalized = normalizeQuestionEditorInput({ options: snapshot.options as { id: string; text: string }[], correctOptionIds: snapshot.correctOptionIds as string[] });
      const explanationData = snapshot.explanationStatus !== undefined || snapshot.explanation !== undefined
        ? {
            explanation: snapshot.explanation ?? null,
            explanationStatus: snapshot.explanationStatus ?? "NONE",
            explanationVersion: snapshot.explanationVersion ?? 0,
            explanationRejectReason: snapshot.explanationRejectReason ?? null,
            explanationReviewedById: snapshot.explanationReviewedById ?? null,
            explanationReviewedAt: snapshot.explanationReviewedAt ? new Date(snapshot.explanationReviewedAt) : null,
          }
        : {};
      const changed = await tx.question.updateMany({ where: { id, version }, data: { ...snapshot, ...explanationData, type: normalized.type, optionCount: normalized.optionCount, correctOptionCount: normalized.correctOptionCount, selectionSpec: normalized.selectionSpec, options: normalized.options as Prisma.InputJsonValue, correctOptionIds: normalized.correctOptionIds as Prisma.InputJsonValue, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
      const updated = await tx.question.findFirstOrThrow({ where: { id } });
      await tx.questionRevision.create({ data: { questionId: id, revision: updated.version, snapshot: toQuestionSnapshot(updated), changeSource: "TEACHER_RESTORE", actorUserId: user.id } });
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "QUESTION_RESTORE", targetType: "Question", targetId: id, metadata: { restoredRevision: revision, version: updated.version } });
      return updated;
    });
    return NextResponse.json({ saved: true, version: restored.version });
  } catch (error) {
    return apiErrorResponse(error, "恢复题目修订失败");
  }
}
