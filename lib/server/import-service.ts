import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { isImportBatchExpired } from "@/lib/domain/import-batch";
import { validateImportRow } from "@/lib/domain/question-import";
import type { ImportQuestionRow } from "@/lib/domain/types";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";

type ImportBatchReportOptions = { page: number; pageSize: number; issuesOnly?: boolean };

export async function getImportBatchReport(batchId: string, options: ImportBatchReportOptions) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, fileName: true, status: true, totalRows: true, validRows: true, warningRows: true, errorRows: true, insertedRows: true, duplicateRows: true, createdAt: true, expiresAt: true, committedAt: true, revertedAt: true },
  });
  if (!batch) throw new ApiError("导入批次不存在", 404);

  const where: Prisma.ImportBatchRowWhereInput = { batchId };
  if (options.issuesOnly) where.NOT = { issues: { equals: [] } };
  const skip = (options.page - 1) * options.pageSize;
  const [items, total] = await Promise.all([
    prisma.importBatchRow.findMany({ where, orderBy: { rowNumber: "asc" }, skip, take: options.pageSize, select: { id: true, rowNumber: true, payload: true, issues: true, valid: true } }),
    prisma.importBatchRow.count({ where }),
  ]);
  return { batch, items, page: options.page, pageSize: options.pageSize, total, totalPages: Math.max(1, Math.ceil(total / options.pageSize)) };
}

export async function commitImportBatch(importedById: string, batchId: string) {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, importedById },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) throw new ApiError("导入批次不存在", 404);
  if (batch.status !== "PREVIEW") throw new ApiError("该导入批次不能再次提交", 409);
  if (batch.expiresAt ? new Date() >= batch.expiresAt : isImportBatchExpired(batch.createdAt)) throw new ApiError("导入预检已过期，请重新上传文件", 410);
  if (batch.errorRows > 0) throw new ApiError(`仍有 ${batch.errorRows} 行错误，不能确认导入`);

  const validated = batch.rows.map((stored) => validateImportRow(stored.payload as unknown as ImportQuestionRow));
  const invalid = validated.filter((item) => item.issues.some((issue) => issue.severity === "error"));
  if (invalid.length) throw new ApiError(`仍有 ${invalid.length} 行错误，不能确认导入`);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.importBatch.updateMany({
      where: { id: batch.id, status: "PREVIEW" },
      data: { status: "COMMITTED", committedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ApiError("该导入批次已被处理", 409);

    const levelCodes = [...new Set(validated.map((item) => item.row.levelCode))];
    const levels = await tx.level.findMany({ where: { code: { in: levelCodes }, enabled: true } });
    const levelByCode = new Map(levels.map((level) => [level.code, level]));
    for (const item of validated) {
      if (!levelByCode.has(item.row.levelCode)) throw new ApiError(`第 ${item.row.rowNumber} 行等级 ${item.row.levelCode} 不存在或已停用`, 409);
    }

    const knowledgeByCode = new Map<string, Awaited<ReturnType<typeof ensureKnowledgePoint>>>();
    for (const item of validated) {
      if (!knowledgeByCode.has(item.row.categoryCode)) {
        knowledgeByCode.set(item.row.categoryCode, await ensureKnowledgePoint(tx, item.row.categoryCode, item.row.knowledgePointName));
      }
    }
    const knowledgePoints = await tx.knowledgePoint.findMany({
      where: { id: { in: [...knowledgeByCode.values()].map((point) => point.id) } },
      include: { _count: { select: { children: true } } },
    });
    const knowledgeById = new Map(knowledgePoints.map((point) => [point.id, point]));

    const questions: Prisma.QuestionCreateManyInput[] = validated.map((item) => {
      const level = levelByCode.get(item.row.levelCode)!;
      const knowledgePoint = knowledgeByCode.get(item.row.categoryCode)!;
      if ((knowledgeById.get(knowledgePoint.id)?._count.children ?? 0) > 0) {
        throw new ApiError(`第 ${item.row.rowNumber} 行知识点 ${knowledgePoint.code} 不是末级节点`, 409);
      }
      return {
        levelId: level.id,
        knowledgePointId: knowledgePoint.id,
        sourceBankCode: item.row.sourceBankCode || null,
        externalQuestionCode: item.row.externalQuestionCode || null,
        stem: item.row.stem,
        type: item.type,
        optionCount: item.optionCount,
        correctOptionCount: item.correctOptionCount,
        selectionSpec: item.selectionSpec,
        options: item.options as Prisma.InputJsonValue,
        correctOptionIds: item.correctOptionIds,
        status: item.row.enabled === false ? "DISABLED" : "ACTIVE",
        importBatchId: batch.id,
      };
    });

    const inserted = questions.length ? (await tx.question.createMany({ data: questions, skipDuplicates: true })).count : 0;
    const skipped = questions.length - inserted;
    await tx.importBatch.update({ where: { id: batch.id }, data: { insertedRows: inserted, duplicateRows: skipped } });
    return { batchId: batch.id, inserted, skipped };
  }, { timeout: 60_000 });
}
