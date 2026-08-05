import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { isImportBatchExpired } from "@/lib/domain/import-batch";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { classifyImportDuplicate, findBatchDuplicateRows, importQuestionContentKey, importRowLocation, validateImportRow } from "@/lib/domain/question-import";
import { revalidateCommitRowImages } from "@/lib/domain/question-image-marker";
import type { ImportQuestionRow, ValidatedQuestionRow } from "@/lib/domain/types";
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

export async function getImportBatchImage(importedById: string, batchId: string, imageId: string) {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, courseId: RADIO_COURSE_ID, importedById },
    select: { id: true },
  });
  if (!batch) throw new ApiError("导入批次不存在", 404);
  const image = await prisma.importBatchImage.findFirst({
    where: { batchId, id: imageId },
    select: { data: true, mimeType: true, sizeBytes: true },
  });
  if (!image) throw new ApiError("图片不存在", 404);
  return { data: Uint8Array.from(image.data), mimeType: image.mimeType, sizeBytes: image.sizeBytes };
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
      include: { rows: { orderBy: { rowNumber: "asc" } }, images: true },
    });
    if (batch.expiresAt ? new Date() >= batch.expiresAt : isImportBatchExpired(batch.createdAt)) throw new ApiError("导入预检已过期，请重新上传文件", 410);

    const validated = batch.rows.map((stored) => validateImportRow(stored.payload as unknown as ImportQuestionRow));
    const imageById = new Map(batch.images.map((image) => [image.id, image]));
    const hashById = (imageId: string) => imageById.get(imageId)?.contentHash;
    for (const item of validated) {
      item.issues.push(...revalidateCommitRowImages(item.row, batch.images));
    }
    const batchDuplicates = findBatchDuplicateRows(validated, hashById);
    if (batchDuplicates.size) throw new ApiError(`本批次有 ${batchDuplicates.size} 行重复题目，不能确认导入`, 409);
    const invalid = validated.filter((item) => item.issues.some((issue) => issue.severity === "error"));
    if (invalid.length) throw new ApiError(`仍有 ${invalid.length} 行错误，不能确认导入`);

    const levelCodes = [...new Set(validated.map((item) => item.row.levelCode))];
    const levels = await tx.level.findMany({ where: { courseId: RADIO_COURSE_ID, code: { in: levelCodes }, enabled: true } });
    const levelByCode = new Map(levels.map((level) => [level.code, level]));
    for (const item of validated) {
      if (!levelByCode.has(item.row.levelCode)) throw new ApiError(`${importRowLocation(item.row)} 等级 ${item.row.levelCode} 不存在或已停用`, 409);
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
        throw new ApiError(`${importRowLocation(item.row)} 知识点 ${knowledgePoint.code} 不是末级节点`, 409);
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
      select: { levelId: true, externalQuestionCode: true, stem: true, options: true, correctOptionIds: true, images: { select: { id: true, contentHash: true } } },
    }) : [];
    const existingByCode = new Map(existingCoded.map((question) => [`${question.levelId}|${question.externalQuestionCode}`, question]));
    const unnumberedQuestions = questions.filter((question) => !question.externalQuestionCode);
    const existingForSuspects = unnumberedQuestions.length ? await tx.question.findMany({
      where: { courseId: RADIO_COURSE_ID },
      select: { externalQuestionCode: true, stem: true, options: true, correctOptionIds: true, images: { select: { id: true, contentHash: true } } },
    }) : [];
    const imagesHashById = (question: { images: Array<{ id: string; contentHash: string }> }) => {
      const byId = new Map(question.images.map((image) => [image.id, image.contentHash]));
      return (imageId: string) => byId.get(imageId);
    };
    const exactQuestionCodes = new Set<string>();
    const duplicateCounts = { exact: 0, conflicts: 0, suspects: 0 };
    for (const question of questions) {
      const existing = question.externalQuestionCode
        ? existingByCode.get(`${question.levelId}|${question.externalQuestionCode}`)
        : existingForSuspects.find((candidate) => classifyImportDuplicate(question, candidate, hashById, imagesHashById(candidate)) === "SUSPECT");
      if (!existing) continue;
      const kind = classifyImportDuplicate(question, existing, hashById, imagesHashById(existing));
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
    if (inserted) {
      const imagesByRowNumber = new Map<number, (typeof batch.images)[number][]>();
      for (const image of batch.images) {
        const list = imagesByRowNumber.get(image.rowNumber) ?? [];
        list.push(image);
        imagesByRowNumber.set(image.rowNumber, list);
      }
      const identityOf = (item: ValidatedQuestionRow, levelId: string) => item.row.externalQuestionCode?.trim()
        ? `code:${levelId}|${item.row.externalQuestionCode.trim()}`
        : `content:${importQuestionContentKey({ stem: item.row.stem, options: item.options, correctOptionIds: item.correctOptionIds }, hashById)}`;
      const insertedIdentityOf = (question: (typeof insertedQuestions)[number]) => question.externalQuestionCode?.trim()
        ? `code:${question.levelId}|${question.externalQuestionCode.trim()}`
        : `content:${importQuestionContentKey({ stem: question.stem, options: question.options, correctOptionIds: question.correctOptionIds }, hashById)}`;
      const questionIdByIdentity = new Map(insertedQuestions.map((question) => [insertedIdentityOf(question), question.id]));
      const questionImages: Prisma.QuestionImageCreateManyInput[] = [];
      for (const item of validated) {
        const rowImages = imagesByRowNumber.get(item.row.rowNumber);
        if (!rowImages?.length) continue;
        const level = levelByCode.get(item.row.levelCode)!;
        const isExactDuplicate = item.row.externalQuestionCode?.trim()
          ? exactQuestionCodes.has(`${level.id}|${item.row.externalQuestionCode.trim()}`)
          : false;
        if (isExactDuplicate) continue;
        const questionId = questionIdByIdentity.get(identityOf(item, level.id));
        if (!questionId) throw new ApiError("图片归属的题目未写入，请重新预检", 409);
        for (const image of rowImages) {
          questionImages.push({
            id: image.id,
            courseId: RADIO_COURSE_ID,
            questionId,
            field: image.field,
            sortOrder: image.sortOrder,
            data: image.data,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            contentHash: image.contentHash,
          });
        }
      }
      if (questionImages.length) await tx.questionImage.createMany({ data: questionImages });
    }
    await tx.importBatchImage.deleteMany({ where: { batchId: batch.id } });
    if (insertedQuestions.length) await tx.questionRevision.createMany({ data: insertedQuestions.map((question) => ({ courseId: RADIO_COURSE_ID, questionId: question.id, revision: question.version, snapshot: toQuestionSnapshot(question), changeSource: "IMPORT_COMMIT", actorUserId: importedById })) });
    await tx.importBatch.update({ where: { id: batch.id }, data: { insertedRows: inserted, duplicateRows: skipped } });
    await writeAuditLogInTransaction(tx, { actorUserId: importedById, action: "IMPORT_COMMIT", targetType: "ImportBatch", targetId: batch.id, metadata: { inserted, skipped, suspectedDuplicates: duplicateCounts.suspects } });
    return { batchId: batch.id, inserted, skipped };
  }, { timeout: 60_000 });
}
