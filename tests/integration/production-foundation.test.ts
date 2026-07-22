import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { getDatabaseSchema } from "../../lib/domain/database-url";
import { commitImportBatch, getImportBatchReport, revertImportBatch } from "../../lib/server/import-service";
import { createPracticeSession, getPracticeSession, submitPracticeAnswer } from "../../lib/server/practice-service";
import { createSessionToken, findSessionUser, verifySessionToken } from "../../lib/server/session";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema: getDatabaseSchema(connectionString) }) });

beforeAll(() => {
  if (!connectionString.includes("practice")) throw new Error("Integration tests require an isolated practice database");
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await prisma.knowledgePoint.deleteMany();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
});

async function createBaseRecords() {
  const user = await prisma.user.create({ data: { username: "student", displayName: "Student", passwordHash: "test", role: "STUDENT" } });
  const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
  const point = await prisma.knowledgePoint.create({ data: { code: "1.1", name: "Point", path: "/1/1.1", depth: 1 } });
  const question = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "Q-1", stem: "Original", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
  return { user, level, point, question };
}

describe("production database foundation", () => {
  it("keeps a question snapshot unchanged after the source question is edited", async () => {
    const { user, level, point, question } = await createBaseRecords();
    const snapshot = { questionId: question.id, levelId: level.id, knowledgePointId: point.id, stem: "Original", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], levelCode: "A", knowledgeName: "Point" };
    const session = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0 } });
    await prisma.practiceSessionQuestion.create({ data: { sessionId: session.id, questionId: question.id, position: 0, snapshot } });
    await prisma.question.update({ where: { id: question.id }, data: { stem: "Changed", correctOptionIds: ["B"] } });
    const stored = await prisma.practiceSessionQuestion.findFirstOrThrow({ where: { sessionId: session.id } });
    expect(stored.snapshot).toMatchObject({ stem: "Original", correctOptionIds: ["A"] });
  });

  it("prevents duplicate question codes inside the same level", async () => {
    const { level, point } = await createBaseRecords();
    await expect(prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "Q-1", stem: "Duplicate", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })).rejects.toBeTruthy();
  });

  it("persists all five thousand import preview rows", async () => {
    const teacher = await prisma.user.create({ data: { username: "teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const batch = await prisma.importBatch.create({ data: { fileName: "large.xlsx", importedById: teacher.id, totalRows: 5000, validRows: 5000 } });
    await prisma.importBatchRow.createMany({ data: Array.from({ length: 5000 }, (_, index) => ({ batchId: batch.id, rowNumber: index + 2, payload: { rowNumber: index + 2 }, issues: [], valid: true })) });
    expect(await prisma.importBatchRow.count({ where: { batchId: batch.id } })).toBe(5000);
  });

  it("commits all five thousand validated rows and counts duplicates", async () => {
    const teacher = await prisma.user.create({ data: { username: "teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "9.1.1", name: "Bulk Point", path: "/9/9.1/9.1.1", depth: 2 } });
    await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "BULK-1", stem: "Existing", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }, { id: "D", text: "D" }], correctOptionIds: ["A"] } });
    const batch = await prisma.importBatch.create({ data: { fileName: "large.xlsx", importedById: teacher.id, totalRows: 5000, validRows: 5000, expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.importBatchRow.createMany({ data: Array.from({ length: 5000 }, (_, index) => ({
      batchId: batch.id,
      rowNumber: index + 2,
      payload: { rowNumber: index + 2, levelCode: "A", categoryCode: "9.1.1", knowledgePointName: "Bulk Point", externalQuestionCode: `BULK-${index + 1}`, stem: `Question ${index + 1}`, rawAnswer: "A", declaredSelectionSpec: "4选1", optionValues: { A: "A", B: "B", C: "C", D: "D" }, enabled: true },
      issues: [],
      valid: true,
    })) });

    const result = await commitImportBatch(teacher.id, batch.id);

    expect(result).toEqual({ batchId: batch.id, inserted: 4999, skipped: 1 });
    expect(await prisma.question.count({ where: { importBatchId: batch.id } })).toBe(4999);
    expect(await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({ status: "COMMITTED", insertedRows: 4999, duplicateRows: 1 });
  }, 30_000);

  it("paginates only import rows with warnings or errors", async () => {
    const teacher = await prisma.user.create({ data: { username: "teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const batch = await prisma.importBatch.create({ data: { fileName: "issues.xlsx", importedById: teacher.id, totalRows: 3, validRows: 2, warningRows: 1, errorRows: 1 } });
    await prisma.importBatchRow.createMany({ data: [
      { batchId: batch.id, rowNumber: 2, payload: { stem: "Valid" }, issues: [], valid: true },
      { batchId: batch.id, rowNumber: 3, payload: { stem: "Warning" }, issues: [{ severity: "warning", field: "题目编号", message: "编号提示不一致" }], valid: true },
      { batchId: batch.id, rowNumber: 4, payload: { stem: "Error" }, issues: [{ severity: "error", field: "答案", message: "答案无效" }], valid: false },
    ] });

    const report = await getImportBatchReport(batch.id, { page: 1, pageSize: 20, issuesOnly: true });

    expect(report.items.map((row) => row.rowNumber)).toEqual([3, 4]);
    expect(report.total).toBe(2);
    expect(report.batch).toMatchObject({ id: batch.id, warningRows: 1, errorRows: 1 });
  });

  it("creates, resumes, grades, and completes a practice session from immutable snapshots", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });

    const created = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });
    expect(created.questions).toHaveLength(1);
    expect(created.questions[0].stem).toBe("Original");

    await prisma.question.update({ where: { id: question.id }, data: { stem: "Changed", correctOptionIds: ["B"] } });
    const resumed = await getPracticeSession(user.id, created.id);
    expect(resumed?.questions[0].stem).toBe("Original");

    const result = await submitPracticeAnswer(user.id, created.id, question.id, ["A"]);
    expect(result.isCorrect).toBe(true);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: "COMPLETED", currentIndex: 1, correctCount: 1 });
  });

  it("invalidates an old session after the user session version changes", async () => {
    const user = await prisma.user.create({ data: { username: "session-user", displayName: "Session User", passwordHash: "test", role: "STUDENT" } });
    const token = await createSessionToken({ userId: user.id, username: user.username, role: user.role, sessionVersion: user.sessionVersion });
    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(await findSessionUser(payload!)).toMatchObject({ id: user.id, sessionVersion: 0 });

    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });

    expect(await findSessionUser(payload!)).toBeNull();
  });

  it("creates at most twenty wrong-question items and updates mastery", async () => {
    const user = await prisma.user.create({ data: { username: "wrong-user", displayName: "Wrong User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "8.1.1", name: "Wrong Point", path: "/8/8.1/8.1.1", depth: 2 } });
    const questions = await Promise.all(Array.from({ length: 25 }, (_, index) => prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: `WRONG-${index + 1}`, stem: `Wrong ${index + 1}`, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));
    await prisma.wrongQuestion.createMany({ data: questions.map((question) => ({ userId: user.id, questionId: question.id })) });

    const session = await createPracticeSession(user.id, { mode: "wrong" });

    expect(session.mode).toBe("WRONG_QUESTION");
    expect(session.total).toBe(20);
    expect((await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).levelId).toBeNull();
    const [correctQuestion, incorrectQuestion] = session.questions;
    await submitPracticeAnswer(user.id, session.id, correctQuestion.id, ["A"]);
    await submitPracticeAnswer(user.id, session.id, incorrectQuestion.id, ["B"]);
    expect(await prisma.wrongQuestion.findUniqueOrThrow({ where: { userId_questionId: { userId: user.id, questionId: correctQuestion.id } } })).toMatchObject({ mastered: true, wrongCount: 1 });
    expect(await prisma.wrongQuestion.findUniqueOrThrow({ where: { userId_questionId: { userId: user.id, questionId: incorrectQuestion.id } } })).toMatchObject({ mastered: false, wrongCount: 2 });
  });

  it("deletes unused imported questions, archives referenced ones, and prevents repeated revert", async () => {
    const teacher = await prisma.user.create({ data: { username: "revert-teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const student = await prisma.user.create({ data: { username: "revert-student", displayName: "Student", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "7.1.1", name: "Revert Point", path: "/7/7.1/7.1.1", depth: 2 } });
    const batch = await prisma.importBatch.create({ data: { fileName: "revert.xlsx", importedById: teacher.id, status: "COMMITTED", totalRows: 2, validRows: 2, insertedRows: 2 } });
    const [used, unused] = await Promise.all([
      prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, importBatchId: batch.id, externalQuestionCode: "REVERT-USED", stem: "Used", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
      prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, importBatchId: batch.id, externalQuestionCode: "REVERT-UNUSED", stem: "Unused", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
    ]);
    const session = await prisma.practiceSession.create({ data: { userId: student.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0 } });
    await prisma.practiceSessionQuestion.create({ data: { sessionId: session.id, questionId: used.id, position: 0, snapshot: { questionId: used.id, levelId: level.id, knowledgePointId: point.id, stem: used.stem, type: used.type, optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], levelCode: level.code, knowledgeName: point.name } } });

    expect(await revertImportBatch(batch.id)).toEqual({ archived: 1, deleted: 1 });
    expect(await prisma.question.findUnique({ where: { id: unused.id } })).toBeNull();
    expect(await prisma.question.findUniqueOrThrow({ where: { id: used.id } })).toMatchObject({ status: "ARCHIVED" });
    expect(await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({ status: "REVERTED" });
    await expect(revertImportBatch(batch.id)).rejects.toMatchObject({ status: 409 });
  });
});
