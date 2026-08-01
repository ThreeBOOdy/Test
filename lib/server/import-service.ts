import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { isImportBatchExpired } from "@/lib/domain/import-batch";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { classifyImportDuplicate, findBatchDuplicateRows, validateImportRow } from "@/lib/domain/question-import";
import type { ImportQuestionRow } from "@/lib/domain/types";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";
import { toQuestionSnapshot } from "@/lib/server/question-revisions";
import { writeAuditLogInTransaction } from "@/lib/server/audit";

type ImportBatchReportOptions = { page: number; pageSize: number; issuesOnly?: boolean };

export async function revertImportBatch(batchId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, courseId: RADIO_COURSE_ID, importedById: actorUserId } });
    if (!batch) throw new ApiError("导入批次不存在", 404);
    if (batch.status !== "COMMITTED") throw new ApiError("只有已提交批次可以撤销", 409);
    const questionsToArchive = await tx.question.findMany({
      where: { courseId: RADIO_COURSE_ID, importBatchId: batchId, status: { not: "ARCHIVED" } },
      select: { id: true, version: true, levelId: true, knowledgePointId: true, sourceBankCode: true, externalQuestionCode: true, stem: true, preserveOptionOrder: true, options: true, correctOptionIds: true },
    });
    const archived = await tx.question.updateMany({ where: { id: { in: questionsToArchive.map((question) => question.id) }, courseId: RADIO_COURSE_ID }, data: { status: "ARCHIVED", version: { increment: 1 } } });
    if (questionsToArchive.length) {
      await tx.questionRevision.createMany({ data: questionsToArchive.map((question) => ({
        courseId: RADIO_COURSE_ID,
        questionId: question.id,
        revision: question.version + 1,
        snapshot: toQuestionSnapshot({ ...question, status: "ARCHIVED" }),
        changeSource: "IMPORT_REVERT_ARCHIVE",
        actorUserId,
      })) });
    }
    await tx.importBatch.update({ where: { id: batchId }, data: { status: "REVERTED", revertedAt: new Date() } });
    const result = { archived: archived.count };
    await writeAuditLogInTransaction(tx, { actorUserId, action: "IMPORT_REVERT", targetType: "ImportBatch", targetId: batchId, metadata: result });
    return result;
  });
}

export async function getImportBatchReport(importedById: string, batchId: string, options: ImportBatchReportOptions) {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, courseId: RADIO_COURSE_ID, importedById },
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
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.importBatch.updateMany({
      where: { id: batchId, courseId: RADIO_COURSE_ID, importedById, status: "PREVIEW" },
      data: { status: "COMMITTED", committedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ApiError("该导入批次已被处理", 409);

    const batch = await tx.importBatch.findFirstOrThrow({
      where: { id: batchId, courseId: RADIO_COURSE_ID, importedById },
      include: { rows: { orderBy: { rowNumber: "asc" } } },
    });
    if (batch.expiresAt ? new Date() >= batch.expiresAt : isImportBatchExpired(batch.createdAt)) throw new ApiError("导入预检已过期，请重新上传文件", 410);

    const validated = batch.rows.map((stored) => validateImportRow(stored.payload as unknown as ImportQuestionRow));
    const batchDuplicates = findBatchDuplicateRows(validated);
    if (batchDuplicates.size) throw new ApiError(`本批次有 ${batchDuplicates.size} 行重复题目，不能确认导入`, 409);
    const invalid = validated.filter((item) => item.issues.some((issue) => issue.severity === "error"));
    if (invalid.length) throw new ApiError(`仍有 ${invalid.length} 行错误，不能确认导入`);

    const levelCodes = [...new Set(validated.map((item) => item.row.levelCode))];
    const levels = await tx.level.findMany({ where: { courseId: RADIO_COURSE_ID, code: { in: levelCodes }, enabled: true } });
    const levelByCode = new Map(levels.map((level) => [level.code, level]));
    for (const item of validated) {
      if (!levelByCode.has(item.row.levelCode)) throw new ApiError(`${formatImportLocation(item.row)} 等级 ${item.row.levelCode} 不存在或已停用`, 409);
    }

    const knowledgeByCode = new Map<string, Awaited<ReturnType<typeof ensureKnowledgePoint>>>();
    for (const item of validated) {
      if (!knowledgeByCode.has(item.row.categoryCode)) {
        knowledgeByCode.set(item.row.categoryCode, await ensureKnowledgePoint(tx, item.row.categoryCode, item.row.knowledgePointName));
      }
    }
    const knowledgePoints = await tx.knowledgePoint.findMany({
      where: { courseId: RADIO_COURSE_ID, id: { in: [...knowledgeByCode.values()].map((point) => point.id) } },
      include: { _count: { select: { children: true } } },
    });
    const knowledgeById = new Map(knowledgePoints.map((point) => [point.id, point]));

    const questions: Prisma.QuestionCreateManyInput[] = validated.map((item) => {
      const level = levelByCode.get(item.row.levelCode)!;
      const knowledgePoint = knowledgeByCode.get(item.row.categoryCode)!;
      if ((knowledgeById.get(knowledgePoint.id)?._count.children ?? 0) > 0) {
        throw new ApiError(`${formatImportLocation(item.row)} 知识点 ${knowledgePoint.code} 不是末级节点`, 409);
      }
      return {
        courseId: RADIO_COURSE_ID,
        levelId: level.id,
        knowledgePointId: knowledgePoint.id,
        sourceBankCode: item.row.sourceBankCode || null,
        externalQuestionCode: item.row.externalQuestionCode || null,
        stem: item.row.stem,
        type: item.type,
        optionCount: item.optionCount,
        correctOptionCount: item.correctOptionCount,
        selectionSpec: item.selectionSpec,
        preserveOptionOrder: item.row.preserveOptionOrder ?? false,
        options: item.options as Prisma.InputJsonValue,
        correctOptionIds: item.correctOptionIds as Prisma.InputJsonValue,
        status: item.row.enabled === false ? "DISABLED" : "ACTIVE",
        importBatchId: batch.id,
      };
    });

    const codedQuestions = questions.filter((question) => question.externalQuestionCode);
    const existingCoded = codedQuestions.length ? await tx.question.findMany({
      where: { courseId: RADIO_COURSE_ID, OR: codedQuestions.map((question) => ({ levelId: question.levelId, externalQuestionCode: question.externalQuestionCode! })) },
      select: { levelId: true, externalQuestionCode: true, stem: true, options: true, correctOptionIds: true },
    }) : [];
    const existingByCode = new Map(existingCoded.map((question) => [`${question.levelId}|${question.externalQuestionCode}`, question]));
    const unnumberedQuestions = questions.filter((question) => !question.externalQuestionCode);
    const existingForSuspects = unnumberedQuestions.length ? await tx.question.findMany({
      where: { courseId: RADIO_COURSE_ID },
      select: { externalQuestionCode: true, stem: true, options: true, correctOptionIds: true },
    }) : [];
    const exactQuestionCodes = new Set<string>();
    const duplicateCounts = { exact: 0, conflicts: 0, suspects: 0 };
    for (const question of questions) {
      const existing = question.externalQuestionCode
        ? existingByCode.get(`${question.levelId}|${question.externalQuestionCode}`)
        : existingForSuspects.find((candidate) => classifyImportDuplicate(question, candidate) === "SUSPECT");
      if (!existing) continue;
      const kind = classifyImportDuplicate(question, existing);
      if (kind === "EXACT") {
        duplicateCounts.exact += 1;
        exactQuestionCodes.add(`${question.levelId}|${question.externalQuestionCode}`);
      }
      if (kind === "CONFLICT") duplicateCounts.conflicts += 1;
      if (kind === "SUSPECT") duplicateCounts.suspects += 1;
    }
    if (duplicateCounts.conflicts || duplicateCounts.suspects) {
      throw new ApiError(`题库已发生变化：内容冲突 ${duplicateCounts.conflicts} 行、无编号疑似重复 ${duplicateCounts.suspects} 行；请人工处理后重新预检`, 409);
    }

    const questionsToInsert = questions.filter((question) => !question.externalQuestionCode || !exactQuestionCodes.has(`${question.levelId}|${question.externalQuestionCode}`));
    const inserted = questionsToInsert.length ? (await tx.question.createMany({ data: questionsToInsert })).count : 0;
    const skipped = questions.length - inserted;
    const insertedQuestions = inserted ? await tx.question.findMany({ where: { courseId: RADIO_COURSE_ID, importBatchId: batch.id }, select: { id: true, version: true, levelId: true, knowledgePointId: true, sourceBankCode: true, externalQuestionCode: true, stem: true, preserveOptionOrder: true, options: true, correctOptionIds: true, status: true } }) : [];
    if (insertedQuestions.length) await tx.questionRevision.createMany({ data: insertedQuestions.map((question) => ({ courseId: RADIO_COURSE_ID, questionId: question.id, revision: question.version, snapshot: toQuestionSnapshot(question), changeSource: "IMPORT_COMMIT", actorUserId: importedById })) });
    await tx.importBatch.update({ where: { id: batch.id }, data: { insertedRows: inserted, duplicateRows: skipped } });
    await writeAuditLogInTransaction(tx, { actorUserId: importedById, action: "IMPORT_COMMIT", targetType: "ImportBatch", targetId: batch.id, metadata: { inserted, skipped, suspectedDuplicates: duplicateCounts.suspects } });
    return { batchId: batch.id, inserted, skipped };
  }, { timeout: 60_000 });
}

function formatImportLocation(row: ImportQuestionRow) {
  return row.sheetName ? `${row.sheetName}!${row.rowNumber}` : `第 ${row.rowNumber} 行`;
}
