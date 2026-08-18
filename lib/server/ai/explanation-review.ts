import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import {
  EXPLANATION_STATUS_APPROVED,
  EXPLANATION_STATUS_DRAFT,
  EXPLANATION_STATUS_NONE,
  EXPLANATION_STATUS_REJECTED,
  parseExplanationResponse,
  serializeExplanation,
  type ExplanationContent,
} from "@/lib/server/ai/explanation";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { normalizePagination, createPageResult } from "@/lib/server/pagination";
import { toExplanationReviewSnapshot } from "@/lib/server/question-revisions";
import { STALE_VERSION_MESSAGE } from "@/lib/server/question-revisions";

export const EXPLANATION_REVIEW_ACTIONS = ["APPROVE", "REJECT", "APPROVE_WITH_EDITS"] as const;
export type ExplanationReviewAction = (typeof EXPLANATION_REVIEW_ACTIONS)[number];

export const EXPLANATION_STATUSES = [
  EXPLANATION_STATUS_NONE,
  EXPLANATION_STATUS_DRAFT,
  EXPLANATION_STATUS_APPROVED,
  EXPLANATION_STATUS_REJECTED,
] as const;
export type ExplanationStatus = (typeof EXPLANATION_STATUSES)[number];

type ExplanationListRow = {
  id: string;
  externalQuestionCode: string | null;
  stem: string;
  type: string;
  explanationStatus: string;
  explanationVersion: number;
  explanationRejectReason: string | null;
  explanation: string | null;
  updatedAt: Date;
  reviewedAt: Date | null;
  explanationReviewedBy: { displayName: string } | null;
  levels: Array<{ level: { id: string; code: string; name: string } }>;
  knowledgePoint: { id: string; code: string; name: string };
};

type ExplanationDetailRow = ExplanationListRow & {
  sourceBankCode: string | null;
  options: Prisma.JsonValue;
  correctOptionIds: Prisma.JsonValue;
  selectionSpec: string;
  version: number;
  explanationReviewedBy: { id: string; displayName: string } | null;
};

export type ExplanationReviewListItem = {
  id: string;
  externalQuestionCode: string | null;
  stem: string;
  type: string;
  explanationStatus: string;
  explanationVersion: number;
  explanationRejectReason: string | null;
  explanation: ExplanationContent | null;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  level: { id: string; code: string; name: string };
  knowledgePoint: { id: string; code: string; name: string };
};

export type ExplanationReviewDetail = ExplanationReviewListItem & {
  sourceBankCode: string | null;
  options: Prisma.JsonValue;
  correctOptionIds: Prisma.JsonValue;
  selectionSpec: string;
  version: number;
  reviewedById: string | null;
};

export type ListExplanationReviewsParams = {
  page?: string | number;
  pageSize?: string | number;
  status?: string;
  search?: string;
  levelId?: string;
};

export type SubmitExplanationReviewInput = {
  questionId: string;
  actorUserId: string;
  action: ExplanationReviewAction;
  content?: ExplanationContent;
  rejectReason?: string;
  version: number;
};

function parseStoredExplanation(value: string | null): ExplanationContent | null {
  if (!value) return null;
  return parseExplanationResponse(value);
}

function toReviewListItem(row: ExplanationListRow): ExplanationReviewListItem {
  return {
    id: row.id,
    externalQuestionCode: row.externalQuestionCode,
    stem: row.stem,
    type: row.type,
    explanationStatus: row.explanationStatus,
    explanationVersion: row.explanationVersion,
    explanationRejectReason: row.explanationRejectReason,
    explanation: parseStoredExplanation(row.explanation),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedByName: row.explanationReviewedBy?.displayName ?? null,
    level: row.levels[0]?.level ?? { id: "", code: "", name: "未归类" },
    knowledgePoint: row.knowledgePoint,
  };
}

function toReviewDetail(row: ExplanationDetailRow): ExplanationReviewDetail {
  return {
    ...toReviewListItem(row),
    sourceBankCode: row.sourceBankCode,
    options: row.options,
    correctOptionIds: row.correctOptionIds,
    selectionSpec: row.selectionSpec,
    version: row.version,
    reviewedById: row.explanationReviewedBy?.id ?? null,
  };
}

export async function listExplanationReviews(params: ListExplanationReviewsParams) {
  const { page, pageSize, skip } = normalizePagination({ page: params.page, pageSize: params.pageSize });
  const status = params.status && params.status !== "ALL" ? params.status : undefined;
  const where: Prisma.QuestionWhereInput = {
    ...(status ? { explanationStatus: status } : {}),
    ...(params.levelId ? { levels: { some: { levelId: params.levelId } } } : {}),
    ...(params.search
      ? {
          OR: [
            { stem: { contains: params.search } },
            { externalQuestionCode: { contains: params.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        levels: { include: { level: { select: { id: true, code: true, name: true } } } },
        knowledgePoint: { select: { id: true, code: true, name: true } },
        explanationReviewedBy: { select: { displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);

  return createPageResult(
    rows.map((row) => toReviewListItem(row as unknown as ExplanationListRow)),
    total,
    page,
    pageSize,
  );
}

export async function getExplanationReviewDetail(questionId: string) {
  const row = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      levels: { include: { level: { select: { id: true, code: true, name: true } } } },
      knowledgePoint: { select: { id: true, code: true, name: true } },
      explanationReviewedBy: { select: { id: true, displayName: true } },
    },
  });
  if (!row) throw new ApiError("题目不存在", 404);

  return toReviewDetail(row as unknown as ExplanationDetailRow);
}

function changeSourceFor(action: ExplanationReviewAction): string {
  if (action === "APPROVE_WITH_EDITS") return "EXPLANATION_APPROVE_WITH_EDITS";
  if (action === "REJECT") return "EXPLANATION_REJECT";
  return "EXPLANATION_APPROVE";
}

function auditActionFor(action: ExplanationReviewAction): string {
  if (action === "APPROVE_WITH_EDITS") return "EXPLANATION_APPROVE_WITH_EDITS";
  if (action === "REJECT") return "EXPLANATION_REJECT";
  return "EXPLANATION_APPROVE";
}

export async function submitExplanationReview(input: SubmitExplanationReviewInput) {
  return prisma.$transaction(async (tx) => {
    const question = await tx.question.findUnique({ where: { id: input.questionId } });
    if (!question) throw new ApiError("题目不存在", 404);
    if (question.version !== input.version) throw new ApiError(STALE_VERSION_MESSAGE, 409);
    if (question.explanationStatus === EXPLANATION_STATUS_NONE) {
      throw new ApiError("该题还没有 AI 解析草稿", 409);
    }
    if (question.explanationStatus === EXPLANATION_STATUS_APPROVED) {
      throw new ApiError("该解析已审核通过，无需重复审核", 409);
    }

    const isApprove = input.action === "APPROVE" || input.action === "APPROVE_WITH_EDITS";
    if (isApprove && !input.content && !question.explanation) {
      throw new ApiError("该题没有可审核的解析内容", 409);
    }
    const nextExplanation = isApprove && input.content ? serializeExplanation(input.content) : question.explanation;
    const nextStatus = isApprove ? EXPLANATION_STATUS_APPROVED : EXPLANATION_STATUS_REJECTED;
    const rejectReason = isApprove ? null : input.rejectReason?.trim() || null;
    const now = new Date();

    const changed = await tx.question.updateMany({
      where: { id: input.questionId, version: input.version },
      data: {
        explanation: nextExplanation,
        explanationStatus: nextStatus,
        explanationRejectReason: rejectReason,
        explanationReviewedById: input.actorUserId,
        explanationReviewedAt: now,
        explanationVersion: { increment: 1 },
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);

    const updated = await tx.question.findUniqueOrThrow({ where: { id: input.questionId } });
    await tx.questionRevision.create({
      data: {
        questionId: input.questionId,
        revision: updated.version,
        snapshot: toExplanationReviewSnapshot(updated),
        changeSource: changeSourceFor(input.action),
        actorUserId: input.actorUserId,
      },
    });
    await writeAuditLogInTransaction(tx, {
      actorUserId: input.actorUserId,
      action: auditActionFor(input.action),
      targetType: "Question",
      targetId: input.questionId,
      metadata: {
        explanationStatus: nextStatus,
        explanationVersion: updated.explanationVersion,
        ...(rejectReason ? { rejectReason } : {}),
        edited: input.action === "APPROVE_WITH_EDITS",
      },
    });

    return {
      saved: true,
      status: nextStatus,
      version: updated.version,
      explanationVersion: updated.explanationVersion,
    };
  });
}
