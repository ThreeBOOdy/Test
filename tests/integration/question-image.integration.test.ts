import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { RADIO_COURSE_ID } from "../../lib/domain/course";
import { getQuestionImage } from "../../lib/server/question-image";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("../../lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { GET } from "../../app/api/v1/question-images/[id]/route";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

beforeAll(() => assertDatabaseName(connectionString, "practice_ci_integration"));

beforeEach(async () => {
  await prisma.authSession.deleteMany();
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentReviewRecord.deleteMany();
  await prisma.sensitiveDataReauthenticationAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.questionImage.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  mocks.getCurrentUser.mockReset();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const deleted = await prisma.knowledgePoint.deleteMany({ where: { children: { none: {} } } });
    if (!deleted.count) throw new Error("Unable to delete knowledge point tree");
  }
}

async function createStoredImage(overrides: { id?: string; field?: string; sortOrder?: number } = {}) {
  const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
  const point = await prisma.knowledgePoint.create({ data: { code: "1.1", name: "Point", path: "/1/1.1", depth: 1 } });
  const question = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "IMG-Q-1", stem: "含图题干", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
  const image = await prisma.questionImage.create({ data: {
    id: overrides.id ?? "img-1",
    questionId: question.id,
    field: overrides.field ?? "STEM",
    sortOrder: overrides.sortOrder ?? 0,
    data: pngBytes,
    mimeType: "image/png",
    sizeBytes: pngBytes.length,
    contentHash: sha256(pngBytes),
  } });
  return { level, point, question, image };
}

describe("question image model and read endpoint", () => {
  it("persists id, binary, format, size, content hash, owning question and field with ordering", async () => {
    const { image } = await createStoredImage({ field: "A", sortOrder: 2 });

    const stored = await prisma.questionImage.findUniqueOrThrow({ where: { id: image.id } });
    expect(stored).toMatchObject({
      id: "img-1",
      courseId: RADIO_COURSE_ID,
      field: "A",
      sortOrder: 2,
      mimeType: "image/png",
      sizeBytes: pngBytes.length,
      contentHash: sha256(pngBytes),
    });
    expect(Buffer.from(stored.data)).toEqual(pngBytes);

    const content = await getQuestionImage(image.id);
    expect(content).toMatchObject({ id: "img-1", mimeType: "image/png", sizeBytes: pngBytes.length, contentHash: sha256(pngBytes) });
    expect(Buffer.from(content?.data ?? new Uint8Array())).toEqual(pngBytes);
  });

  it("rejects unauthenticated image requests", async () => {
    await createStoredImage();
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/question-images/img-1"), { params: Promise.resolve({ id: "img-1" }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "请先登录" });
  });

  it.each([
    ["student", "STUDENT", "FULL_STUDENT"],
    ["teacher", "TEACHER", "FULL_TEACHER"],
  ] as const)("serves image bytes with the correct type and immutable long cache to a logged-in %s", async (_label, role, capability) => {
    await createStoredImage();
    mocks.getCurrentUser.mockResolvedValue({ id: `${role.toLowerCase()}-1`, username: role, displayName: role, role, capability, enabled: true, mustChangePassword: false, activationRequired: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null });

    const response = await GET(new Request("http://localhost/api/v1/question-images/img-1"), { params: Promise.resolve({ id: "img-1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(pngBytes.length));
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("cache-control")).toMatch(/max-age=\d{6,}/);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pngBytes);
  });

  it("returns 404 for unknown image ids without exposing internals", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "student-1", username: "student", displayName: "Student", role: "STUDENT", capability: "FULL_STUDENT", enabled: true, mustChangePassword: false, activationRequired: false, sessionVersion: 0, studentStatus: "ACTIVE", isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null });

    const response = await GET(new Request("http://localhost/api/v1/question-images/missing"), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "图片不存在" });
  });
});
