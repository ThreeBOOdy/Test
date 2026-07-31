import { PrismaClient } from "../../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { cleanupTemporaryData } from "../../lib/server/data-retention-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });
const now = new Date("2026-07-31T00:00:00.000Z");

beforeAll(() => {
  assertDatabaseName(connectionString, "practice_ci_integration");
});

beforeEach(async () => {
  await prisma.authSession.deleteMany();
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentActivation.deleteMany();
  await prisma.examDraft.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.question.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.grade.deleteMany();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const deleted = await prisma.knowledgePoint.deleteMany({ where: { children: { none: {} } } });
    if (!deleted.count) throw new Error("Unable to delete knowledge point tree");
  }
}

async function createUser(username: string) {
  return prisma.user.create({ data: { username, displayName: username, passwordHash: "test", role: "STUDENT" } });
}

async function createSession(userId: string, status: "IN_PROGRESS" | "COMPLETED", startedAt: Date) {
  return prisma.practiceSession.create({
    data: {
      userId,
      mode: "MOCK_EXAM",
      status,
      singleCountSnapshot: 1,
      multipleCountSnapshot: 0,
      currentIndex: status === "COMPLETED" ? 1 : 0,
      correctCount: 0,
      startedAt,
      completedAt: status === "COMPLETED" ? startedAt : null,
    },
  });
}

describe("temporary data retention", () => {
  it("deletes only expired temporary records and remains idempotent", async () => {
    const [expiredUser, currentUser, committedBy] = await Promise.all([
      createUser("expired-user"),
      createUser("current-user"),
      createUser("import-owner"),
    ]);
    const oldSessionDate = new Date("2026-06-30T00:00:00.000Z");
    const currentSessionDate = new Date("2026-07-02T00:00:00.000Z");
    const expiredPreviewDate = new Date("2026-07-30T23:59:59.000Z");
    const currentPreviewDate = new Date("2026-08-01T00:00:00.000Z");

    await prisma.authSession.createMany({
      data: [
        { tokenHash: "expired-session", userId: expiredUser.id, lastSeenAt: oldSessionDate, idleExpiresAt: oldSessionDate, absoluteExpiresAt: oldSessionDate },
        { tokenHash: "current-session", userId: currentUser.id, lastSeenAt: currentSessionDate, idleExpiresAt: currentSessionDate, absoluteExpiresAt: currentSessionDate },
      ],
    });
    await prisma.studentActivation.createMany({
      data: [
        { userId: expiredUser.id, activationCodeHash: "expired", expiresAt: new Date("2026-07-23T00:00:00.000Z") },
        { userId: currentUser.id, activationCodeHash: "current", expiresAt: new Date("2026-07-25T00:00:00.000Z") },
      ],
    });

    const [expiredStudentPreview, currentStudentPreview, committedStudentImport] = await Promise.all([
      prisma.studentImportBatch.create({ data: { fileName: "expired-students.xlsx", status: "PREVIEW", totalRows: 1, validRows: 1, sheetNames: ["学生"], createdById: committedBy.id, expiresAt: expiredPreviewDate } }),
      prisma.studentImportBatch.create({ data: { fileName: "current-students.xlsx", status: "PREVIEW", totalRows: 1, validRows: 1, sheetNames: ["学生"], createdById: committedBy.id, expiresAt: currentPreviewDate } }),
      prisma.studentImportBatch.create({ data: { fileName: "committed-students.xlsx", status: "COMMITTED", totalRows: 1, validRows: 1, sheetNames: ["学生"], createdById: committedBy.id, expiresAt: expiredPreviewDate, committedAt: oldSessionDate } }),
    ]);
    await prisma.studentImportRow.createMany({
      data: [
        { batchId: expiredStudentPreview.id, sheetName: "学生", sourceRowNumber: 2, payload: {}, issues: [], valid: true },
        { batchId: currentStudentPreview.id, sheetName: "学生", sourceRowNumber: 2, payload: {}, issues: [], valid: true },
        { batchId: committedStudentImport.id, sheetName: "学生", sourceRowNumber: 2, payload: {}, issues: [], valid: true },
      ],
    });

    const [expiredQuestionPreview, currentQuestionPreview, committedQuestionImport] = await Promise.all([
      prisma.importBatch.create({ data: { fileName: "expired-questions.xlsx", status: "PREVIEW", totalRows: 1, importedById: committedBy.id, expiresAt: expiredPreviewDate } }),
      prisma.importBatch.create({ data: { fileName: "current-questions.xlsx", status: "PREVIEW", totalRows: 1, importedById: committedBy.id, expiresAt: currentPreviewDate } }),
      prisma.importBatch.create({ data: { fileName: "committed-questions.xlsx", status: "COMMITTED", totalRows: 1, importedById: committedBy.id, expiresAt: expiredPreviewDate, committedAt: oldSessionDate } }),
    ]);
    await prisma.importBatchRow.createMany({
      data: [
        { batchId: expiredQuestionPreview.id, rowNumber: 2, payload: {}, issues: [], valid: true },
        { batchId: currentQuestionPreview.id, rowNumber: 2, payload: {}, issues: [], valid: true },
        { batchId: committedQuestionImport.id, rowNumber: 2, payload: {}, issues: [], valid: true },
      ],
    });

    const [expiredSettledSession, currentSettledSession, oldActiveSession] = await Promise.all([
      createSession(expiredUser.id, "COMPLETED", oldSessionDate),
      createSession(currentUser.id, "COMPLETED", currentSessionDate),
      createSession(committedBy.id, "IN_PROGRESS", oldSessionDate),
    ]);
    const [expiredDraft, currentDraft, activeDraft] = await Promise.all([
      prisma.examDraft.create({ data: { sessionId: expiredSettledSession.id, answers: {}, currentIndex: 0 } }),
      prisma.examDraft.create({ data: { sessionId: currentSettledSession.id, answers: {}, currentIndex: 0 } }),
      prisma.examDraft.create({ data: { sessionId: oldActiveSession.id, answers: {}, currentIndex: 0 } }),
    ]);
    await prisma.examDraft.update({ where: { id: expiredDraft.id }, data: { updatedAt: oldSessionDate } });
    await prisma.examDraft.update({ where: { id: currentDraft.id }, data: { updatedAt: currentSessionDate } });
    await prisma.examDraft.update({ where: { id: activeDraft.id }, data: { updatedAt: oldSessionDate } });

    const level = await prisma.level.create({ data: { code: "A", name: "A" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "1.1", name: "Point", path: "/1/1.1", depth: 1 } });
    const question = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, stem: "Permanent", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const permanentAudit = await prisma.auditLog.create({ data: { action: "PERMANENT_AUDIT", targetType: "Question", targetId: question.id } });

    const first = await cleanupTemporaryData(prisma, now);
    expect(first.failures).toEqual([]);
    expect(first.results.map((result) => [result.category, result.deleted])).toEqual([
      ["authSessions", 1],
      ["studentActivations", 1],
      ["studentImportPreviews", 1],
      ["questionImportPreviews", 1],
      ["settledExamDrafts", 1],
    ]);

    await expect(prisma.authSession.findUnique({ where: { tokenHash: "expired-session" } })).resolves.toBeNull();
    await expect(prisma.authSession.findUnique({ where: { tokenHash: "current-session" } })).resolves.toBeTruthy();
    await expect(prisma.studentActivation.findUnique({ where: { userId: expiredUser.id } })).resolves.toBeNull();
    await expect(prisma.studentActivation.findUnique({ where: { userId: currentUser.id } })).resolves.toBeTruthy();
    await expect(prisma.studentImportBatch.findUnique({ where: { id: expiredStudentPreview.id } })).resolves.toBeNull();
    await expect(prisma.studentImportBatch.findUnique({ where: { id: currentStudentPreview.id } })).resolves.toBeTruthy();
    await expect(prisma.studentImportBatch.findUnique({ where: { id: committedStudentImport.id } })).resolves.toBeTruthy();
    await expect(prisma.importBatch.findUnique({ where: { id: expiredQuestionPreview.id } })).resolves.toBeNull();
    await expect(prisma.importBatch.findUnique({ where: { id: currentQuestionPreview.id } })).resolves.toBeTruthy();
    await expect(prisma.importBatch.findUnique({ where: { id: committedQuestionImport.id } })).resolves.toBeTruthy();
    await expect(prisma.examDraft.findUnique({ where: { id: expiredDraft.id } })).resolves.toBeNull();
    await expect(prisma.examDraft.findUnique({ where: { id: currentDraft.id } })).resolves.toBeTruthy();
    await expect(prisma.examDraft.findUnique({ where: { id: activeDraft.id } })).resolves.toBeTruthy();
    await expect(prisma.question.findUnique({ where: { id: question.id } })).resolves.toBeTruthy();
    await expect(prisma.auditLog.findUnique({ where: { id: permanentAudit.id } })).resolves.toBeTruthy();

    const second = await cleanupTemporaryData(prisma, now);
    expect(second.failures).toEqual([]);
    expect(second.results.every((result) => result.deleted === 0 && result.eligibleBefore === 0 && result.remaining === 0)).toBe(true);
    await expect(prisma.auditLog.count({ where: { action: "RETENTION_CLEANUP_SUCCEEDED" } })).resolves.toBe(10);
  });
});
