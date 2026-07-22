import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { commitImportBatch, getImportBatchReport } from "../../lib/server/import-service";
import { createPracticeSession, getPracticeSession, submitPracticeAnswer } from "../../lib/server/practice-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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
});
