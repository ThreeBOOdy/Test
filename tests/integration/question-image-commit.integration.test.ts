import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { getQuestionImage } from "../../lib/server/question-image";
import { commitImportBatch, revertImportBatch } from "../../lib/server/import-service";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("../../lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { POST as previewImport } from "../../app/api/v1/teacher/imports/preview/route";
import { PNG_BYTES, buildDocx, drawing, mediaRelationship, paragraph } from "../fixtures/word-docx";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

const OTHER_PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

beforeAll(() => assertDatabaseName(connectionString, "practice_ci_integration"));

beforeEach(async () => {
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.reviewCard.deleteMany();
  await prisma.reviewPlan.deleteMany();
  await prisma.focusSession.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.playerLevel.deleteMany();
  await prisma.questLog.deleteMany();
  await prisma.xpLog.deleteMany();
  await prisma.aiUsageLog.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.studentActivation.deleteMany();
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentReviewRecord.deleteMany();
  await prisma.sensitiveDataReauthenticationAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.examDraft.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.questionImage.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchImage.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.radioPerson.deleteMany();
  await prisma.grade.deleteMany();
  mocks.getCurrentUser.mockReset();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const leaves = await prisma.knowledgePoint.findMany({ where: { children: { none: {} } }, select: { id: true } });
    if (!leaves.length) throw new Error("Unable to delete knowledge point tree");
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: leaves.map((leaf) => leaf.id) } } });
  }
}

async function createTeacher(id: string) {
  return prisma.user.create({ data: { id, username: id, displayName: id, passwordHash: "hash", role: "TEACHER" } });
}

function teacherUser(id: string) {
  return { id, username: id, displayName: id, role: "TEACHER", capability: "FULL_TEACHER", enabled: true, mustChangePassword: false, activationRequired: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
}

async function createLevelAndPoint() {
  const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
  const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "4.1.1", name: "Point", path: "/4/4.1.1", depth: 1 } });
  return { level, point };
}

function previewRequest(file: File, fields: Record<string, string> = {}): Request {
  const request = new Request("http://localhost/api/v1/teacher/imports/preview", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
  });
  Object.defineProperty(request, "formData", {
    value: async () => ({ get: (key: string) => (key === "file" ? file : (fields[key] ?? null)) }),
  });
  return request;
}

function uploadFile(buffer: ArrayBuffer, name: string): File {
  const file = new File([buffer], name);
  Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
  return file;
}

async function imageDocx(): Promise<ArrayBuffer> {
  return buildDocx(
    `<w:p><w:r><w:t>1. 含图题干</w:t></w:r>${drawing("rId1")}</w:p>` +
      `<w:p><w:r><w:t>A、选项A</w:t></w:r>${drawing("rId2")}</w:p>` +
      paragraph("B、选项B") +
      paragraph("答案：A"),
    {
      rels: [mediaRelationship("rId1", "media/image1.png"), mediaRelationship("rId2", "media/image2.png")],
      media: { "word/media/image1.png": PNG_BYTES, "word/media/image2.png": PNG_BYTES },
    },
  );
}

async function previewWordDocx(fileName: string, buffer: ArrayBuffer) {
  mocks.getCurrentUser.mockResolvedValue(teacherUser("teacher-1"));
  const response = await previewImport(previewRequest(uploadFile(buffer, fileName), { levelCode: "A", categoryCode: "4.1.1" }));
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body as { batchId: string; rows: Array<{ row: { stem: string; optionValues: Record<string, string> }; images: Array<{ id: string; field: string }> }> };
}

async function createPreviewBatch(teacherId: string, rows: Array<Record<string, unknown>>, images: Array<Record<string, unknown>> = []) {
  const batch = await prisma.importBatch.create({
    data: {
      fileName: "constructed.docx",
      status: "PREVIEW",
      totalRows: rows.length,
      validRows: rows.length,
      importedById: teacherId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await prisma.importBatchRow.createMany({
    data: rows.map((payload, index) => ({
      batchId: batch.id,
      rowNumber: index + 1,
      payload: payload as Prisma.InputJsonValue,
      issues: [],
      valid: true,
    })),
  });
  if (images.length) {
    await prisma.importBatchImage.createMany({
      data: images.map((image) => ({ batchId: batch.id, ...image }) as Prisma.ImportBatchImageCreateManyInput),
    });
  }
  return batch;
}

function codedImageRow(stemMarker: string, code = "IMG-1"): Record<string, unknown> {
  return {
    rowNumber: 1,
    levelCode: "A",
    categoryCode: "4.1.1",
    externalQuestionCode: code,
    stem: `含图题干${stemMarker}`,
    rawAnswer: "A",
    optionValues: { A: "选项A", B: "选项B" },
  };
}

async function createExistingCodedQuestion(imageData: Buffer, imageId: string) {
  const { level, point } = await createLevelAndPoint();
  const question = await prisma.question.create({
    data: {
      knowledgePointId: point.id,
      levels: { create: { levelId: level.id } },
      externalQuestionCode: "IMG-1",
      stem: `含图题干[图:${imageId}]`,
      type: "SINGLE_CHOICE",
      optionCount: 2,
      correctOptionCount: 1,
      selectionSpec: "2选1",
      options: [{ id: "A", text: "选项A" }, { id: "B", text: "选项B" }],
      correctOptionIds: ["A"],
    },
  });
  await prisma.questionImage.create({
    data: {
      id: imageId,
      questionId: question.id,
      field: "STEM",
      sortOrder: 0,
      data: Uint8Array.from(imageData),
      mimeType: "image/png",
      sizeBytes: imageData.length,
      contentHash: sha256(imageData),
    },
  });
  return question;
}

describe("question image commit lifecycle", () => {
  it("migrates batch images into the question table with the same ids and deletes batch copies", async () => {
    await createTeacher("teacher-1");
    await createLevelAndPoint();
    const preview = await previewWordDocx("images.docx", await imageDocx());
    const [stemImage, optionImage] = preview.rows[0].images;
    expect(preview.rows[0].row.stem).toContain(`[图:${stemImage.id}]`);
    expect(preview.rows[0].row.optionValues.A).toContain(`[图:${optionImage.id}]`);

    const result = await commitImportBatch("teacher-1", preview.batchId);
    expect(result).toEqual({ batchId: preview.batchId, inserted: 1, skipped: 0 });

    const question = await prisma.question.findFirstOrThrow({
      where: { importBatchId: preview.batchId },
      include: { images: true, revisions: true },
    });
    expect(question.stem).toContain(`[图:${stemImage.id}]`);
    expect((question.options as Array<{ id: string; text: string }>)[0].text).toContain(`[图:${optionImage.id}]`);
    expect(question.images).toHaveLength(2);
    const migratedStem = question.images.find((image) => image.id === stemImage.id);
    const migratedOption = question.images.find((image) => image.id === optionImage.id);
    expect(migratedStem).toMatchObject({ field: "STEM", sortOrder: 0, mimeType: "image/png", sizeBytes: PNG_BYTES.length, contentHash: sha256(PNG_BYTES) });
    expect(migratedOption).toMatchObject({ field: "A", sortOrder: 0 });
    expect(Buffer.from(migratedStem!.data)).toEqual(PNG_BYTES);

    expect(await prisma.importBatchImage.count({ where: { batchId: preview.batchId } })).toBe(0);
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: preview.batchId } });
    expect(batch.status).toBe("COMMITTED");
    expect(batch.insertedRows).toBe(1);

    const readable = await getQuestionImage(stemImage.id);
    expect(Buffer.from(readable?.data ?? new Uint8Array())).toEqual(PNG_BYTES);
    expect(question.revisions).toEqual([
      expect.objectContaining({ changeSource: "IMPORT_COMMIT", snapshot: expect.objectContaining({ stem: expect.stringContaining(`[图:${stemImage.id}]`) }) }),
    ]);
  });

  it("commits text-only word batches without touching image tables", async () => {
    await createTeacher("teacher-1");
    await createLevelAndPoint();
    const preview = await previewWordDocx(
      "plain.docx",
      await buildDocx(paragraph("1. 纯文本题干") + paragraph("A、选项A") + paragraph("B、选项B") + paragraph("答案：A")),
    );

    const result = await commitImportBatch("teacher-1", preview.batchId);
    expect(result).toEqual({ batchId: preview.batchId, inserted: 1, skipped: 0 });
    expect(await prisma.questionImage.count({ where: { question: { importBatchId: preview.batchId } } })).toBe(0);
    expect(await prisma.importBatchImage.count({ where: { batchId: preview.batchId } })).toBe(0);
  });

  it("skips coded duplicates whose image bytes are identical under different ids", async () => {
    await createTeacher("teacher-1");
    await createExistingCodedQuestion(PNG_BYTES, "qimg_existing");
    const batch = await createPreviewBatch(
      "teacher-1",
      [codedImageRow("[图:qimg_new]")],
      [{ id: "qimg_new", rowNumber: 1, field: "STEM", sortOrder: 0, data: Uint8Array.from(PNG_BYTES), mimeType: "image/png", sizeBytes: PNG_BYTES.length, contentHash: sha256(PNG_BYTES) }],
    );

    const result = await commitImportBatch("teacher-1", batch.id);
    expect(result).toEqual({ batchId: batch.id, inserted: 0, skipped: 1 });
    expect(await prisma.question.count()).toBe(1);
    expect(await prisma.questionImage.count({ where: { id: "qimg_new" } })).toBe(0);
    expect(await prisma.importBatchImage.count({ where: { batchId: batch.id } })).toBe(0);
  });

  it("treats different image bytes as a conflict for coded duplicates", async () => {
    await createTeacher("teacher-1");
    await createExistingCodedQuestion(PNG_BYTES, "qimg_existing");
    const batch = await createPreviewBatch(
      "teacher-1",
      [codedImageRow("[图:qimg_new]")],
      [{ id: "qimg_new", rowNumber: 1, field: "STEM", sortOrder: 0, data: Uint8Array.from(OTHER_PNG_BYTES), mimeType: "image/png", sizeBytes: OTHER_PNG_BYTES.length, contentHash: sha256(OTHER_PNG_BYTES) }],
    );

    await expect(commitImportBatch("teacher-1", batch.id)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("内容冲突 1 行") });
    expect(await prisma.question.count()).toBe(1);
    expect(await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({ status: "PREVIEW" });
  });

  it("flags uncoded word duplicates as suspected when image bytes match", async () => {
    await createTeacher("teacher-1");
    await createLevelAndPoint();
    const first = await previewWordDocx("first.docx", await imageDocx());
    await expect(commitImportBatch("teacher-1", first.batchId)).resolves.toMatchObject({ inserted: 1, skipped: 0 });

    const second = await previewWordDocx("second.docx", await imageDocx());
    await expect(commitImportBatch("teacher-1", second.batchId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("无编号疑似重复 1 行") });
    expect(await prisma.importBatch.findUniqueOrThrow({ where: { id: second.batchId } })).toMatchObject({ status: "PREVIEW" });
  });

  it("reapplies ownership and per-question limit rules at commit time", async () => {
    await createTeacher("teacher-1");
    await createLevelAndPoint();
    const unknownBatch = await createPreviewBatch("teacher-1", [codedImageRow("[图:qimg_ghost]")]);
    await expect(commitImportBatch("teacher-1", unknownBatch.id)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("仍有 1 行错误") });

    const oversizedBatch = await createPreviewBatch(
      "teacher-1",
      [codedImageRow("[图:qimg_big]")],
      [{ id: "qimg_big", rowNumber: 1, field: "STEM", sortOrder: 0, data: Uint8Array.from(PNG_BYTES), mimeType: "image/png", sizeBytes: 5 * 1024 * 1024 + 1, contentHash: sha256(PNG_BYTES) }],
    );
    await expect(commitImportBatch("teacher-1", oversizedBatch.id)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("仍有 1 行错误") });

    const unsupportedBatch = await createPreviewBatch(
      "teacher-1",
      [codedImageRow("[图:qimg_tiff]")],
      [{ id: "qimg_tiff", rowNumber: 1, field: "STEM", sortOrder: 0, data: Uint8Array.from(PNG_BYTES), mimeType: "image/tiff", sizeBytes: PNG_BYTES.length, contentHash: sha256(PNG_BYTES) }],
    );
    await expect(commitImportBatch("teacher-1", unsupportedBatch.id)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("仍有 1 行错误") });
    expect(await prisma.question.count()).toBe(0);
  });

  it("keeps question images readable after reverting a committed batch", async () => {
    await createTeacher("teacher-1");
    await createLevelAndPoint();
    const preview = await previewWordDocx("revert.docx", await imageDocx());
    const imageId = preview.rows[0].images[0].id;
    await expect(commitImportBatch("teacher-1", preview.batchId)).resolves.toMatchObject({ inserted: 1, skipped: 0 });

    await expect(revertImportBatch(preview.batchId, "teacher-1")).resolves.toEqual({ archived: 1 });

    const question = await prisma.question.findFirstOrThrow({
      where: { importBatchId: preview.batchId },
      include: { images: true, revisions: true },
    });
    expect(question.status).toBe("ARCHIVED");
    expect(question.images.map((image) => image.id)).toContain(imageId);
    const readable = await getQuestionImage(imageId);
    expect(Buffer.from(readable?.data ?? new Uint8Array())).toEqual(PNG_BYTES);
    expect(question.revisions).toEqual([
      expect.objectContaining({ changeSource: "IMPORT_COMMIT" }),
      expect.objectContaining({ changeSource: "IMPORT_REVERT_ARCHIVE", snapshot: expect.objectContaining({ stem: expect.stringContaining(`[图:${imageId}]`) }) }),
    ]);
  });
});
