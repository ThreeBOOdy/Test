import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("../../lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { POST as previewImport } from "../../app/api/v1/teacher/imports/preview/route";
import { GET as getBatchImage } from "../../app/api/v1/teacher/import-batches/[id]/images/[imageId]/route";
import { PNG_BYTES, buildDocx, drawing, mediaRelationship, paragraph } from "../fixtures/word-docx";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

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
    const deleted = await prisma.knowledgePoint.deleteMany({ where: { children: { none: {} } } });
    if (!deleted.count) throw new Error("Unable to delete knowledge point tree");
  }
}

async function createTeacher(id: string) {
  return prisma.user.create({ data: { id, username: id, displayName: id, passwordHash: "hash", role: "TEACHER" } });
}

function teacherUser(id: string) {
  return { id, username: id, displayName: id, role: "TEACHER", capability: "FULL_TEACHER", enabled: true, mustChangePassword: false, activationRequired: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
}

function studentUser(id: string) {
  return { id, username: id, displayName: id, role: "STUDENT", capability: "FULL_STUDENT", enabled: true, mustChangePassword: false, activationRequired: false, sessionVersion: 0, studentStatus: "ACTIVE", isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
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
      paragraph("A、选项A") +
      paragraph("B、选项B") +
      paragraph("答案：A"),
    {
      rels: [mediaRelationship("rId1", "media/image1.png")],
      media: { "word/media/image1.png": PNG_BYTES },
    },
  );
}

describe("import batch image preview pipeline", () => {
  it("persists extracted images with stable ids, previews them, and lets only the owning teacher read them", async () => {
    await createTeacher("teacher-1");
    await createTeacher("teacher-2");
    mocks.getCurrentUser.mockResolvedValue(teacherUser("teacher-1"));

    const response = await previewImport(previewRequest(uploadFile(await imageDocx(), "images.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.rows[0].images).toHaveLength(1);
    const imageId = body.rows[0].images[0].id as string;
    expect(body.rows[0].row.stem).toContain(`[图:${imageId}]`);

    const stored = await prisma.importBatchImage.findUniqueOrThrow({ where: { id: imageId } });
    expect(stored).toMatchObject({
      batchId: body.batchId,
      rowNumber: 1,
      field: "STEM",
      sortOrder: 0,
      mimeType: "image/png",
      sizeBytes: PNG_BYTES.length,
      contentHash: sha256(PNG_BYTES),
    });
    expect(Buffer.from(stored.data)).toEqual(PNG_BYTES);

    mocks.getCurrentUser.mockResolvedValue(teacherUser("teacher-1"));
    const teacherResponse = await getBatchImage(new Request(`http://localhost/api/v1/teacher/import-batches/${body.batchId}/images/${imageId}`), { params: Promise.resolve({ id: body.batchId, imageId }) });
    expect(teacherResponse.status).toBe(200);
    expect(teacherResponse.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await teacherResponse.arrayBuffer())).toEqual(PNG_BYTES);

    mocks.getCurrentUser.mockResolvedValue(studentUser("student-1"));
    const studentResponse = await getBatchImage(new Request(`http://localhost/api/v1/teacher/import-batches/${body.batchId}/images/${imageId}`), { params: Promise.resolve({ id: body.batchId, imageId }) });
    expect(studentResponse.status).toBe(403);

    mocks.getCurrentUser.mockResolvedValue(teacherUser("teacher-2"));
    const otherTeacherResponse = await getBatchImage(new Request(`http://localhost/api/v1/teacher/import-batches/${body.batchId}/images/${imageId}`), { params: Promise.resolve({ id: body.batchId, imageId }) });
    expect(otherTeacherResponse.status).toBe(404);

    mocks.getCurrentUser.mockResolvedValue(null);
    const anonymousResponse = await getBatchImage(new Request(`http://localhost/api/v1/teacher/import-batches/${body.batchId}/images/${imageId}`), { params: Promise.resolve({ id: body.batchId, imageId }) });
    expect(anonymousResponse.status).toBe(401);

    mocks.getCurrentUser.mockResolvedValue(teacherUser("teacher-1"));
    const missingResponse = await getBatchImage(new Request(`http://localhost/api/v1/teacher/import-batches/${body.batchId}/images/missing`), { params: Promise.resolve({ id: body.batchId, imageId: "missing" }) });
    expect(missingResponse.status).toBe(404);
  });

  it("normalizes question-bank duplicate checks by image content hash", async () => {
    await createTeacher("teacher-1");
    mocks.getCurrentUser.mockResolvedValue(teacherUser("teacher-1"));
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "4.1.1", name: "Point", path: "/4/4.1.1", depth: 1 } });
    await prisma.question.create({
      data: {
        levelId: level.id,
        knowledgePointId: point.id,
        stem: "含图题干[图:qimg_existing]",
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
        id: "qimg_existing",
        questionId: (await prisma.question.findFirstOrThrow({ select: { id: true } })).id,
        field: "STEM",
        sortOrder: 0,
        data: PNG_BYTES,
        mimeType: "image/png",
        sizeBytes: PNG_BYTES.length,
        contentHash: sha256(PNG_BYTES),
      },
    });

    const response = await previewImport(previewRequest(uploadFile(await imageDocx(), "duplicate-image.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.rows[0].issues).toEqual([
      expect.objectContaining({ severity: "warning", field: "重复题目", message: "未填写题号，内容与公共题库题目相同，请人工确认" }),
    ]);
  });
});
