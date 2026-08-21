import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { commitImportBatch, getImportBatchReport, revertImportBatch } from "../../lib/server/import-service";
import { abandonMockExam, createPracticeSession, getPracticeSession, saveExamDraft, settleExpiredMockExams, submitMockExam, submitPracticeAnswer, updatePracticeSessionLearningMode } from "../../lib/server/practice-service";
import { createSession, findSessionUser, revokeSession, revokeUserSessions } from "../../lib/server/session";
import { getTeacherLearningStatistics } from "../../lib/server/learning-statistics-service";
import { getTodayReviewPlan } from "../../lib/server/review-plan-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

beforeAll(() => {
  assertDatabaseName(connectionString, "practice_ci_integration");
});

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
  await prisma.studentLevelQuestionState.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.studentLevelProgress.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.questionImage.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchImage.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.examBlueprintItem.deleteMany();
  await prisma.examBlueprint.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  // User.activeLevel has a RESTRICT FK to Level, so detach it before deleting levels.
  await prisma.user.updateMany({ data: { activeLevelId: null } });
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.radioPerson.deleteMany();
  await prisma.grade.deleteMany();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const leaves = await prisma.knowledgePoint.findMany({ where: { children: { none: {} } }, select: { id: true } });
    if (!leaves.length) throw new Error("Unable to delete knowledge point tree");
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: leaves.map((leaf) => leaf.id) } } });
  }
}

async function createBaseRecords() {
  const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
  const user = await prisma.user.create({ data: { username: "student", displayName: "Student", passwordHash: "test", role: "STUDENT", activeLevelId: level.id } });
  const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "1.1", name: "Point", path: "/1/1.1", depth: 1 } });
  const question = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "Q-1", stem: "Original", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
  return { user, level, point, question };
}

async function createDefaultMockBlueprint(levelId: string, knowledgePointId: string, singleCount: number, multipleCount: number, durationMinutes = 40, passingCount = 1) {
  return prisma.examBlueprint.create({
    data: {
      levelId,
      name: "默认模拟测试",
      durationMinutes,
      passingCount,
      isDefault: true,
      items: { create: [{ knowledgePointId, singleCount, multipleCount }] },
    },
  });
}

async function correctAnswerFor(sessionId: string, questionId: string): Promise<string[]> {
  const stored = await prisma.practiceSessionQuestion.findFirstOrThrow({ where: { sessionId, questionId }, select: { snapshot: true } });
  const correctOptionIds = (stored.snapshot as { correctOptionIds?: unknown }).correctOptionIds;
  return Array.isArray(correctOptionIds) ? correctOptionIds.map(String) : [];
}

describe("production database foundation", () => {
  it("persists student account foundations and review history", async () => {
    const grade = await prisma.grade.create({ data: { code: "GRADE_7", name: "七年级", sortOrder: 7 } });
    const administrator = await prisma.user.create({ data: { username: "administrator", displayName: "Administrator", passwordHash: "test", role: "ADMIN" } });
    const student = await prisma.user.create({ data: {
      username: "legacy-student", displayName: "Legacy Student", passwordHash: "test", role: "STUDENT",
      studentStatus: "ACTIVE", registrationSource: "LEGACY", nationalIdEncrypted: "encrypted-id", nationalIdHash: "id-hash", nationalIdLast4: "1234",
      gender: "MALE", school: "Test School", gradeId: grade.id, phoneEncrypted: "encrypted-phone", phoneHash: "phone-hash", phoneLast4: "5678",
      reviewedAt: new Date("2026-07-26T00:00:00.000Z"), reviewedById: administrator.id, isLongTerm: true, profileIncomplete: false,
    } });
    const review = await prisma.studentReviewRecord.create({ data: {
      studentId: student.id, actorUserId: administrator.id, action: "APPROVED", beforeStatus: "PENDING", afterStatus: "ACTIVE",
      profileSnapshot: { displayName: student.displayName, school: student.school, gradeCode: grade.code },
    } });

    expect(await prisma.user.findUniqueOrThrow({ where: { id: student.id }, include: { grade: true, reviewedBy: true } })).toMatchObject({
      studentStatus: "ACTIVE", registrationSource: "LEGACY", isLongTerm: true, grade: { code: "GRADE_7" }, reviewedBy: { role: "ADMIN" },
    });
    expect(await prisma.studentReviewRecord.findUniqueOrThrow({ where: { id: review.id }, include: { student: true, actor: true } })).toMatchObject({
      action: "APPROVED", beforeStatus: "PENDING", afterStatus: "ACTIVE", student: { id: student.id }, actor: { id: administrator.id },
    });
    await expect(prisma.user.create({ data: { username: "duplicate-id", displayName: "Duplicate", passwordHash: "test", nationalIdHash: "id-hash" } })).rejects.toBeTruthy();
    await expect(prisma.user.create({ data: { username: "duplicate-phone", displayName: "Duplicate", passwordHash: "test", phoneHash: "phone-hash" } })).rejects.toBeTruthy();
  });

  it("round-trips long question text and JSON answer arrays", async () => {
    const { user, level, point, question } = await createBaseRecords();
    const longStem = "无线电题干".repeat(1000);
    const updated = await prisma.question.update({ where: { id: question.id }, data: { stem: longStem, correctOptionIds: ["A"] } });
    expect(updated.stem).toHaveLength(longStem.length);
    expect(updated.correctOptionIds).toEqual(["A"]);

    const snapshot = { questionId: question.id, levelId: level.id, knowledgePointId: point.id, stem: longStem, type: "SINGLE_CHOICE" as const, optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], levelCode: "A", knowledgeName: "Point" };
    const session = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0 } });
    await prisma.practiceSessionQuestion.create({ data: { sessionId: session.id, questionId: question.id, position: 0, snapshot } });
    await submitPracticeAnswer(user.id, session.id, question.id, ["A"], "base-answer-key");

    const answer = await prisma.practiceAnswer.findUniqueOrThrow({ where: { sessionId_questionId: { sessionId: session.id, questionId: question.id } } });
    expect(answer.selectedOptionIds).toEqual(["A"]);
  });

  it("runs MySQL aggregate and learning-duration queries", async () => {
    const { user, point, question } = await createBaseRecords();
    const startedAt = new Date("2026-07-24T10:00:00.000Z");
    const completedAt = new Date("2026-07-24T10:42:00.000Z");
    const session = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", status: "COMPLETED", singleCountSnapshot: 1, multipleCountSnapshot: 0, correctCount: 1, startedAt, completedAt } });
    await prisma.practiceAnswer.create({ data: { sessionId: session.id, questionId: question.id, selectedOptionIds: ["A"], isCorrect: true, submittedAt: completedAt } });

    const [activeRows, knowledgeRows, studentRows, durationRows] = await Promise.all([
      prisma.$queryRaw<Array<{ count: number | bigint | string }>>(Prisma.sql`SELECT CAST(COUNT(DISTINCT \`userId\`) AS SIGNED) AS count FROM \`PracticeSession\` WHERE \`startedAt\` >= ${startedAt}`),
      prisma.$queryRaw<Array<{ code: string; answered: number | bigint | string; correct: number | bigint | string }>>(Prisma.sql`SELECT kp.code, CAST(COUNT(pa.id) AS SIGNED) AS answered, CAST(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END) AS SIGNED) AS correct FROM \`PracticeAnswer\` pa JOIN \`Question\` q ON q.id = pa.\`questionId\` JOIN \`KnowledgePoint\` kp ON kp.id = q.\`knowledgePointId\` GROUP BY kp.id, kp.code`),
      prisma.$queryRaw<Array<{ userId: string; sessionCount: number | bigint | string; answered: number | bigint | string; correct: number | bigint | string }>>(Prisma.sql`SELECT ps.\`userId\`, CAST(COUNT(DISTINCT ps.id) AS SIGNED) AS \`sessionCount\`, CAST(COUNT(pa.id) AS SIGNED) AS answered, CAST(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END) AS SIGNED) AS correct FROM \`PracticeSession\` ps LEFT JOIN \`PracticeAnswer\` pa ON pa.\`sessionId\` = ps.id WHERE ps.\`userId\` = ${user.id} GROUP BY ps.\`userId\``),
      prisma.$queryRaw<Array<{ minutes: number | string }>>(Prisma.sql`SELECT CAST(COALESCE(SUM(TIMESTAMPDIFF(SECOND, \`startedAt\`, \`completedAt\`)), 0) AS SIGNED) / 60 AS minutes FROM \`PracticeSession\` WHERE \`userId\` = ${user.id} AND \`status\` = 'COMPLETED'`),
    ]);

    expect(Number(activeRows[0]?.count)).toBe(1);
    expect(knowledgeRows[0]).toMatchObject({ code: point.code });
    expect(Number(knowledgeRows[0]?.answered)).toBe(1);
    expect(Number(knowledgeRows[0]?.correct)).toBe(1);
    expect(Number(studentRows[0]?.sessionCount)).toBe(1);
    expect(Number(studentRows[0]?.answered)).toBe(1);
    expect(Number(studentRows[0]?.correct)).toBe(1);
    expect(Number(durationRows[0]?.minutes)).toBe(42);
  });

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
    await expect(prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "Q-1", stem: "Duplicate", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })).rejects.toBeTruthy();
  });

  it("persists all five thousand import preview rows", async () => {
    const teacher = await prisma.user.create({ data: { username: "teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const batch = await prisma.importBatch.create({ data: { fileName: "large.xlsx", importedById: teacher.id, totalRows: 5000, validRows: 5000 } });
    await prisma.importBatchRow.createMany({ data: Array.from({ length: 5000 }, (_, index) => ({ batchId: batch.id, rowNumber: index + 2, payload: { rowNumber: index + 2 }, issues: [], valid: true })) });
    expect(await prisma.importBatchRow.count({ where: { batchId: batch.id } })).toBe(5000);
  });

  it("commits validated rows while explicitly counting exact duplicates", async () => {
    const teacher = await prisma.user.create({ data: { username: "teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.1.1", name: "Bulk Point", path: "/9/9.1/9.1.1", depth: 2 } });
    await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BULK-1", stem: "Question 1", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }, { id: "D", text: "D" }], correctOptionIds: ["A"] } });
    const batch = await prisma.importBatch.create({ data: { fileName: "large.xlsx", importedById: teacher.id, totalRows: 5000, validRows: 5000, expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.importBatchRow.createMany({ data: Array.from({ length: 5000 }, (_, index) => ({
      batchId: batch.id,
      rowNumber: index + 2,
      payload: { rowNumber: index + 2, levelCode: "A", categoryCode: "9.1.1", knowledgePointName: "Bulk Point", externalQuestionCode: `BULK-${index + 1}`, stem: `Question ${index + 1}`, rawAnswer: "A", declaredSelectionSpec: "4选1", optionValues: { A: "A", B: "B", C: "C", D: "D" }, enabled: true },
      issues: [],
      valid: true,
    })) });

    const result = await commitImportBatch(teacher.id, batch.id);

    expect(result).toMatchObject({ batchId: batch.id, inserted: 4999, skipped: 1 });
    expect(result.questionIds).toHaveLength(4999);
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

    const report = await getImportBatchReport(teacher.id, batch.id, { page: 1, pageSize: 20, issuesOnly: true });

    expect(report.items.map((row) => row.rowNumber)).toEqual([3, 4]);
    expect(report.total).toBe(2);
    expect(report.batch).toMatchObject({ id: batch.id, warningRows: 1, errorRows: 1 });
  });

  it("denies import batch reports to other teachers", async () => {
    const [owner, other] = await Promise.all([
      prisma.user.create({ data: { username: "import-owner", displayName: "Owner", passwordHash: "test", role: "TEACHER" } }),
      prisma.user.create({ data: { username: "import-other", displayName: "Other", passwordHash: "test", role: "TEACHER" } }),
    ]);
    const batch = await prisma.importBatch.create({ data: { fileName: "private.xlsx", importedById: owner.id } });

    await expect(getImportBatchReport(other.id, batch.id, { page: 1, pageSize: 20 })).rejects.toMatchObject({ status: 404 });
  });

  it("fails submission when a duplicate appears after preflight", async () => {
    const teacher = await prisma.user.create({ data: { username: "race-teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "8.1.1", name: "Race Point", path: "/8/8.1/8.1.1", depth: 2 } });
    const batch = await prisma.importBatch.create({ data: { fileName: "race.xlsx", importedById: teacher.id, totalRows: 1, validRows: 1, expiresAt: new Date(Date.now() + 60_000) } });
    const payload = { rowNumber: 2, levelCode: "A", categoryCode: "8.1.1", knowledgePointName: "Race Point", externalQuestionCode: "RACE-1", stem: "Race question", rawAnswer: "A", declaredSelectionSpec: "2选1", optionValues: { A: "A", B: "B" }, enabled: true };
    await prisma.importBatchRow.create({ data: { batchId: batch.id, rowNumber: 2, payload, issues: [], valid: true } });
    await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "RACE-1", stem: "Conflicting concurrent question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });

    await expect(commitImportBatch(teacher.id, batch.id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.question.count({ where: { importBatchId: batch.id } })).toBe(0);
  });

  it("rejects duplicate rows within one submission batch", async () => {
    const teacher = await prisma.user.create({ data: { username: "batch-duplicate-teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const batch = await prisma.importBatch.create({ data: { fileName: "duplicates.xlsx", importedById: teacher.id, totalRows: 2, validRows: 2, expiresAt: new Date(Date.now() + 60_000) } });
    const payload = { levelCode: "A", categoryCode: "9.1.1", knowledgePointName: "Bulk Point", externalQuestionCode: "BATCH-1", stem: "Same question", rawAnswer: "A", declaredSelectionSpec: "2选1", optionValues: { A: "A", B: "B" }, enabled: true };
    await prisma.importBatchRow.createMany({ data: [
      { batchId: batch.id, rowNumber: 2, payload: { ...payload, rowNumber: 2 }, issues: [], valid: true },
      { batchId: batch.id, rowNumber: 3, payload: { ...payload, rowNumber: 3 }, issues: [], valid: true },
    ] });

    await expect(commitImportBatch(teacher.id, batch.id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.question.count({ where: { importBatchId: batch.id } })).toBe(0);
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

    const result = await submitPracticeAnswer(user.id, created.id, question.id, await correctAnswerFor(created.id, question.id), "snapshot-answer-key");
    expect(result.isCorrect).toBe(true);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: "COMPLETED", currentIndex: 1, correctCount: 1 });
  });

  it("writes StudentLevelQuestionState on first practice answer and advances it on a repeated answer", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });

    const firstSession = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });
    const correctAnswer = await correctAnswerFor(firstSession.id, question.id);
    await submitPracticeAnswer(user.id, firstSession.id, question.id, correctAnswer, "state-first-key");

    const firstState = await prisma.studentLevelQuestionState.findUniqueOrThrow({
      where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: question.id } },
    });
    expect(firstState).toMatchObject({
      state: "REVIEW",
      reps: 1,
      lapses: 0,
      wrongCount: 0,
      correctCount: 1,
      intervalDays: 1,
      lastResult: "CORRECT",
    });
    expect(firstState.dueAt).not.toBeNull();

    const secondSession = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });
    const secondCorrectAnswer = await correctAnswerFor(secondSession.id, question.id);
    const wrongAnswer = ["A", "B"].filter((id) => !secondCorrectAnswer.includes(id));
    await submitPracticeAnswer(user.id, secondSession.id, question.id, wrongAnswer, "state-second-key");

    const secondState = await prisma.studentLevelQuestionState.findUniqueOrThrow({
      where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: question.id } },
    });
    expect(secondState).toMatchObject({
      state: "RELEARNING",
      reps: 2,
      lapses: 1,
      wrongCount: 1,
      correctCount: 1,
      intervalDays: 0,
      lastResult: "INCORRECT",
    });
    expect(secondState.dueAt).not.toBeNull();
  });

  it("writes StudentLevelQuestionState for mock exam settlement without applying favorite/ignored rating mapping", async () => {
    const { user, level, question } = await createBaseRecords();
    await createDefaultMockBlueprint(level.id, question.knowledgePointId, 1, 0, 40, 1);
    await prisma.studentLevelQuestionState.create({
      data: { userId: user.id, levelId: level.id, questionId: question.id, favorite: true },
    });

    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });
    const correctAnswer = await correctAnswerFor(session.id, question.id);
    await submitMockExam(user.id, session.id, [{ questionId: question.id, selectedOptionIds: correctAnswer }]);

    const state = await prisma.studentLevelQuestionState.findUniqueOrThrow({
      where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: question.id } },
    });
    expect(state.favorite).toBe(true);
    expect(state).toMatchObject({
      state: "REVIEW",
      reps: 1,
      wrongCount: 0,
      correctCount: 1,
      intervalDays: 1,
      stability: 1,
      difficulty: 4.5,
      lastResult: "CORRECT",
    });
  });

  it("writes StudentLevelQuestionState for every mock exam question using plain GOOD/AGAIN mapping", async () => {
    const { user, level } = await createBaseRecords();
    const defaultType = await prisma.knowledgePointType.findUniqueOrThrow({ where: { code: "DEFAULT" } });
    const mockPoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "MOCK-FSRS.1", name: "Mock FSRS Point", path: "/mock-fsrs/mock-fsrs.1", depth: 1 } });
    const favoriteCorrect = await prisma.question.create({ data: { knowledgePointId: mockPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "MOCK-FSRS-FAVORITE-CORRECT", stem: "Favorite correct", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const ignoredCorrect = await prisma.question.create({ data: { knowledgePointId: mockPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "MOCK-FSRS-IGNORED-CORRECT", stem: "Ignored correct", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const ignoredWrong = await prisma.question.create({ data: { knowledgePointId: mockPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "MOCK-FSRS-IGNORED-WRONG", stem: "Ignored wrong", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await prisma.studentLevelQuestionState.createMany({
      data: [
        { userId: user.id, levelId: level.id, questionId: favoriteCorrect.id, favorite: true },
        { userId: user.id, levelId: level.id, questionId: ignoredCorrect.id, ignored: true },
        { userId: user.id, levelId: level.id, questionId: ignoredWrong.id, ignored: true },
      ],
    });
    await createDefaultMockBlueprint(level.id, mockPoint.id, 3, 0);

    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });
    const favoriteCorrectAnswer = await correctAnswerFor(session.id, favoriteCorrect.id);
    const ignoredCorrectAnswer = await correctAnswerFor(session.id, ignoredCorrect.id);
    const ignoredWrongAnswer = await correctAnswerFor(session.id, ignoredWrong.id);
    const wrongAnswer = ["A", "B"].filter((id) => !ignoredWrongAnswer.includes(id));
    await submitMockExam(user.id, session.id, [
      { questionId: favoriteCorrect.id, selectedOptionIds: favoriteCorrectAnswer },
      { questionId: ignoredCorrect.id, selectedOptionIds: ignoredCorrectAnswer },
      { questionId: ignoredWrong.id, selectedOptionIds: wrongAnswer },
    ]);

    const favoriteCorrectState = await prisma.studentLevelQuestionState.findUniqueOrThrow({
      where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: favoriteCorrect.id } },
    });
    const ignoredCorrectState = await prisma.studentLevelQuestionState.findUniqueOrThrow({
      where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: ignoredCorrect.id } },
    });
    const ignoredWrongState = await prisma.studentLevelQuestionState.findUniqueOrThrow({
      where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: ignoredWrong.id } },
    });

    expect(favoriteCorrectState).toMatchObject({
      state: "REVIEW",
      reps: 1,
      lapses: 0,
      wrongCount: 0,
      correctCount: 1,
      intervalDays: 1,
      stability: 1,
      difficulty: 4.5,
      lastResult: "CORRECT",
      favorite: true,
    });
    expect(ignoredCorrectState).toMatchObject({
      state: "REVIEW",
      reps: 1,
      lapses: 0,
      wrongCount: 0,
      correctCount: 1,
      intervalDays: 1,
      stability: 1,
      difficulty: 4.5,
      lastResult: "CORRECT",
      ignored: true,
    });
    expect(ignoredWrongState).toMatchObject({
      state: "LEARNING",
      reps: 1,
      lapses: 0,
      wrongCount: 1,
      correctCount: 0,
      intervalDays: 0,
      stability: 0.3,
      difficulty: 7,
      lastResult: "INCORRECT",
      ignored: true,
    });
    expect(ignoredWrongState.dueAt).not.toBeNull();
  });

  it("generates today's review from FSRS due states and weak knowledge points, not legacy WrongQuestion rows", async () => {
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const user = await prisma.user.create({ data: { username: "review-fsrs-user", displayName: "Review FSRS User", passwordHash: "test", role: "STUDENT", activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const duePoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "FSRS.1", name: "Due Point", path: "/fsrs/due", depth: 1 } });
    const weakPoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "FSRS.2", name: "Weak Point", path: "/fsrs/weak", depth: 1 } });
    const legacyPoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "FSRS.3", name: "Legacy Point", path: "/fsrs/legacy", depth: 1 } });
    const [dueQuestion, weakQuestionOne, weakQuestionTwo, legacyQuestion] = await Promise.all([
      prisma.question.create({ data: { knowledgePointId: duePoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "FSRS-DUE", stem: "Due FSRS question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
      prisma.question.create({ data: { knowledgePointId: weakPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "FSRS-WEAK-1", stem: "Weak one", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
      prisma.question.create({ data: { knowledgePointId: weakPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "FSRS-WEAK-2", stem: "Weak two", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
      prisma.question.create({ data: { knowledgePointId: legacyPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "FSRS-LEGACY", stem: "Legacy wrong only", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
    ]);
    await prisma.wrongQuestion.create({ data: { userId: user.id, questionId: legacyQuestion.id, wrongCount: 9 } });
    await prisma.studentLevelQuestionState.createMany({
      data: [
        {
          userId: user.id,
          levelId: level.id,
          questionId: dueQuestion.id,
          state: "RELEARNING",
          dueAt: new Date("2026-08-21T00:00:00.000Z"),
          stability: 0.8,
          difficulty: 8,
          reps: 3,
          lapses: 2,
          intervalDays: 0,
          lastReviewedAt: new Date("2026-08-21T00:00:00.000Z"),
          favorite: false,
          ignored: false,
          wrongCount: 3,
          correctCount: 0,
          lastResult: "INCORRECT",
        },
        {
          userId: user.id,
          levelId: level.id,
          questionId: weakQuestionOne.id,
          state: "REVIEW",
          dueAt: new Date("2026-08-22T00:00:00.000Z"),
          stability: 2,
          difficulty: 9,
          reps: 6,
          lapses: 2,
          intervalDays: 1,
          lastReviewedAt: new Date("2026-08-20T00:00:00.000Z"),
          favorite: false,
          ignored: false,
          wrongCount: 4,
          correctCount: 2,
          lastResult: "CORRECT",
        },
        {
          userId: user.id,
          levelId: level.id,
          questionId: weakQuestionTwo.id,
          state: "REVIEW",
          dueAt: new Date("2026-08-22T00:00:00.000Z"),
          stability: 1.5,
          difficulty: 7,
          reps: 3,
          lapses: 1,
          intervalDays: 1,
          lastReviewedAt: new Date("2026-08-20T00:00:00.000Z"),
          favorite: false,
          ignored: false,
          wrongCount: 2,
          correctCount: 1,
          lastResult: "CORRECT",
        },
      ],
    });

    const now = new Date("2026-08-21T12:00:00.000Z");
    const plan = await getTodayReviewPlan(user.id, now);
    const cardQuestionIds = plan.cards.map((card) => card.questionId);

    expect(cardQuestionIds).toContain(dueQuestion.id);
    expect(cardQuestionIds).toContain(weakQuestionOne.id);
    expect(cardQuestionIds).toContain(weakQuestionTwo.id);
    expect(cardQuestionIds).not.toContain(legacyQuestion.id);
    expect(plan.cards.find((card) => card.questionId === dueQuestion.id)).toMatchObject({ source: "WRONG_QUESTION" });
    expect(plan.cards.filter((card) => card.questionId === weakQuestionOne.id || card.questionId === weakQuestionTwo.id).every((card) => card.source === "WEAK_KNOWLEDGE")).toBe(true);

    const existing = await getTodayReviewPlan(user.id, now);
    expect(existing.id).toBe(plan.id);
  });

  it("draws practice questions from a K letter-class and injects K into snapshots", async () => {
    const user = await prisma.user.create({ data: { username: "k-practice-user", displayName: "K Practice User", passwordHash: "test", role: "STUDENT" } });
    const kLevel = await prisma.level.create({ data: { code: "K", name: "K Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: kLevel.id } });
    const aLevel = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "K.1", name: "K Point", path: "/K/K.1", depth: 1 } });
    const kQuestion = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: kLevel.id } }, externalQuestionCode: "K-1", stem: "K class question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: aLevel.id } }, externalQuestionCode: "A-1", stem: "A class question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await prisma.levelPracticeRule.create({ data: { levelId: kLevel.id, singleCount: 1, multipleCount: 0 } });

    const session = await createPracticeSession(user.id, { mode: "level", levelCode: "K" });

    expect(session.questions).toHaveLength(1);
    expect(session.questions[0]).toMatchObject({ id: kQuestion.id, levelId: kLevel.id, levelCode: "K" });
    const stored = await prisma.practiceSessionQuestion.findFirstOrThrow({ where: { sessionId: session.id } });
    expect(stored.snapshot).toMatchObject({ questionId: kQuestion.id, levelId: kLevel.id, levelCode: "K" });
  });

  it("blocks unassigned students from creating any practice session", async () => {
    const user = await prisma.user.create({ data: { username: "unassigned-practice-user", displayName: "Unassigned Practice User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: null } });
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });

    await expect(createPracticeSession(user.id, { mode: "level", levelCode: "A" })).rejects.toMatchObject({ status: 403, message: "未分配题库，请联系老师" });
    await expect(createPracticeSession(user.id, { mode: "wrong" })).rejects.toMatchObject({ status: 403, message: "未分配题库，请联系老师" });
  });

  it("rejects creating practice for a level other than the student activeLevel", async () => {
    const levelA = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const levelB = await prisma.level.create({ data: { code: "B", name: "B Level" } });
    const user = await prisma.user.create({ data: { username: "mismatch-practice-user", displayName: "Mismatch Practice User", passwordHash: "test", role: "STUDENT", activeLevelId: levelA.id } });
    await prisma.levelPracticeRule.create({ data: { levelId: levelB.id, singleCount: 1, multipleCount: 0 } });

    await expect(createPracticeSession(user.id, { mode: "level", levelCode: "B" })).rejects.toMatchObject({ status: 403, message: "只能练习当前分配的字母类" });
  });

  it("limits wrong-question practice to the student activeLevel", async () => {
    const levelA = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const levelB = await prisma.level.create({ data: { code: "B", name: "B Level" } });
    const user = await prisma.user.create({ data: { username: "wrong-level-practice-user", displayName: "Wrong Level Practice User", passwordHash: "test", role: "STUDENT", activeLevelId: levelA.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "W.1", name: "Wrong Point", path: "/W/W.1", depth: 1 } });
    const [questionA, questionB] = await Promise.all([
      prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: levelA.id } }, externalQuestionCode: "WA-1", stem: "A wrong", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
      prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: levelB.id } }, externalQuestionCode: "WB-1", stem: "B wrong", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
    ]);
    await prisma.studentLevelQuestionState.createMany({ data: [
      { userId: user.id, levelId: levelA.id, questionId: questionA.id, wrongCount: 1, state: "LEARNING", dueAt: new Date(), reps: 1, lastResult: "INCORRECT" },
      { userId: user.id, levelId: levelB.id, questionId: questionB.id, wrongCount: 1, state: "LEARNING", dueAt: new Date(), reps: 1, lastResult: "INCORRECT" },
    ] });

    const session = await createPracticeSession(user.id, { mode: "wrong" });

    expect(session.questions.map((question) => question.id)).toEqual([questionA.id]);
  });

  it("orders wrong-question practice by favorite, dueAt, wrongCount, and ignored", async () => {
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const user = await prisma.user.create({ data: { username: "wrong-order-user", displayName: "Wrong Order User", passwordHash: "test", role: "STUDENT", activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "WO.1", name: "Wrong Order Point", path: "/WO/WO.1", depth: 1 } });
    const createQuestion = (externalQuestionCode: string, stem: string) => prisma.question.create({
      data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode, stem, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] },
    });
    const [favoriteQuestion, urgentQuestion, ignoredQuestion, laterQuestion, masteredQuestion] = await Promise.all([
      createQuestion("WO-FAV", "Favorite wrong"),
      createQuestion("WO-URG", "Urgent wrong"),
      createQuestion("WO-IGN", "Ignored wrong"),
      createQuestion("WO-LAT", "Later wrong"),
      createQuestion("WO-MAS", "Mastered wrong"),
    ]);
    const sooner = new Date("2026-08-21T00:00:00.000Z");
    const later = new Date("2026-08-22T00:00:00.000Z");
    await prisma.studentLevelQuestionState.createMany({ data: [
      { userId: user.id, levelId: level.id, questionId: favoriteQuestion.id, favorite: true, ignored: false, dueAt: later, wrongCount: 1, state: "LEARNING", reps: 1, lastResult: "INCORRECT" },
      { userId: user.id, levelId: level.id, questionId: urgentQuestion.id, favorite: false, ignored: false, dueAt: sooner, wrongCount: 5, state: "LEARNING", reps: 1, lastResult: "INCORRECT" },
      { userId: user.id, levelId: level.id, questionId: ignoredQuestion.id, favorite: false, ignored: true, dueAt: sooner, wrongCount: 2, state: "LEARNING", reps: 1, lastResult: "INCORRECT" },
      { userId: user.id, levelId: level.id, questionId: laterQuestion.id, favorite: false, ignored: false, dueAt: later, wrongCount: 4, state: "LEARNING", reps: 1, lastResult: "INCORRECT" },
      { userId: user.id, levelId: level.id, questionId: masteredQuestion.id, favorite: false, ignored: false, dueAt: later, wrongCount: 3, state: "REVIEW", intervalDays: 7, reps: 3, lastResult: "CORRECT" },
    ] });

    const session = await createPracticeSession(user.id, { mode: "wrong" });

    expect(session.questions.map((question) => question.id)).toEqual([favoriteQuestion.id, urgentQuestion.id, ignoredQuestion.id, laterQuestion.id]);
  });

  it("loads legacy practice sessions from stored snapshots even when current level associations change", async () => {
    const { user, level, point, question } = await createBaseRecords();
    const snapshot = { questionId: question.id, levelId: level.id, knowledgePointId: point.id, stem: "Original", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], levelCode: "A", knowledgeName: "Point" };
    const session = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0 } });
    await prisma.practiceSessionQuestion.create({ data: { sessionId: session.id, questionId: question.id, position: 0, snapshot } });

    await prisma.questionLevel.deleteMany({ where: { questionId: question.id } });
    await prisma.question.update({ where: { id: question.id }, data: { stem: "Changed", correctOptionIds: ["B"] } });

    const resumed = await getPracticeSession(user.id, session.id);
    expect(resumed?.questions[0]).toMatchObject({ id: question.id, levelId: level.id, levelCode: "A", stem: "Original" });
    expect(JSON.stringify(resumed)).not.toContain("correctOptionIds");
  });

  it("stores only token hashes and invalidates sessions on server-side revocation", async () => {
    const user = await prisma.user.create({ data: {
      username: "session-user", displayName: "Session User", passwordHash: "test", role: "STUDENT", mustChangePassword: false,
      studentStatus: "ACTIVE", isLongTerm: true,
    } });
    const token = await createSession(user);
    expect(await findSessionUser(token)).toMatchObject({ id: user.id, sessionVersion: 0, capability: "FULL_STUDENT" });
    expect((await prisma.authSession.findFirstOrThrow({ where: { userId: user.id } })).tokenHash).not.toBe(token);

    await revokeSession(token);

    expect(await findSessionUser(token)).toBeNull();
  });

  it("allows concurrent valid lookups and refreshes the idle deadline without exceeding absolute expiry", async () => {
    const user = await prisma.user.create({ data: {
      username: "concurrent-session-user", displayName: "Concurrent Session User", passwordHash: "test", role: "TEACHER", mustChangePassword: false,
    } });
    const token = await createSession(user);
    const results = await Promise.all([findSessionUser(token), findSessionUser(token), findSessionUser(token)]);

    expect(results).toEqual([expect.objectContaining({ id: user.id }), expect.objectContaining({ id: user.id }), expect.objectContaining({ id: user.id })]);
    const session = await prisma.authSession.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.idleExpiresAt.getTime()).toBeLessThanOrEqual(session.absoluteExpiresAt.getTime());
  });

  it("supports administrator sessions and trusts the current database role", async () => {
    const administrator = await prisma.user.create({ data: {
      username: "session-administrator", displayName: "Session Administrator", passwordHash: "test", role: "ADMIN", mustChangePassword: false,
    } });
    const token = await createSession(administrator);

    expect(await findSessionUser(token)).toMatchObject({ id: administrator.id, role: "ADMIN", capability: "FULL_ADMIN" });

    await prisma.user.update({ where: { id: administrator.id }, data: { role: "TEACHER" } });

    expect(await findSessionUser(token)).toMatchObject({ id: administrator.id, role: "TEACHER", capability: "FULL_TEACHER" });
  });

  it("re-evaluates student status, validity, and enabled state on every lookup", async () => {
    const student = await prisma.user.create({ data: {
      username: "session-student", displayName: "Session Student", passwordHash: "test", role: "STUDENT", mustChangePassword: false,
      studentStatus: "ACTIVE", isLongTerm: false, validFrom: new Date("2000-01-01T00:00:00.000Z"), validUntil: new Date("2999-12-31T00:00:00.000Z"),
    } });
    const token = await createSession(student);

    expect(await findSessionUser(token)).toMatchObject({ capability: "FULL_STUDENT", studentStatus: "ACTIVE", isLongTerm: false });

    await prisma.user.update({ where: { id: student.id }, data: { studentStatus: "PENDING" } });
    expect(await findSessionUser(token)).toMatchObject({ capability: "REGISTRATION_ONLY", studentStatus: "PENDING" });

    await prisma.user.update({ where: { id: student.id }, data: { studentStatus: "REJECTED" } });
    expect(await findSessionUser(token)).toMatchObject({ capability: "REGISTRATION_ONLY", studentStatus: "REJECTED" });

    await prisma.user.update({ where: { id: student.id }, data: { studentStatus: "ACTIVE", validUntil: new Date("2000-12-31T00:00:00.000Z") } });
    expect(await findSessionUser(token)).toBeNull();

    await prisma.user.update({ where: { id: student.id }, data: { isLongTerm: true } });
    expect(await findSessionUser(token)).toMatchObject({ capability: "FULL_STUDENT", isLongTerm: true });

    await prisma.user.update({ where: { id: student.id }, data: { enabled: false } });
    expect(await findSessionUser(token)).toBeNull();

    await revokeUserSessions(student.id);
    expect(await findSessionUser(token)).toBeNull();
  });

  it("creates wrong-question practice from every unmastered state and updates state", async () => {
    const user = await prisma.user.create({ data: { username: "wrong-user", displayName: "Wrong User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "8.1.1", name: "Wrong Point", path: "/8/8.1/8.1.1", depth: 2 } });
    const questions = await Promise.all(Array.from({ length: 25 }, (_, index) => prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: `WRONG-${index + 1}`, stem: `Wrong ${index + 1}`, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));
    await prisma.studentLevelQuestionState.createMany({ data: questions.map((question) => ({
      userId: user.id,
      levelId: level.id,
      questionId: question.id,
      wrongCount: 1,
      state: "LEARNING",
      dueAt: new Date(),
      reps: 1,
      lastResult: "INCORRECT",
    })) });

    const session = await createPracticeSession(user.id, { mode: "wrong" });

    expect(session.mode).toBe("WRONG_QUESTION");
    expect(session.total).toBe(25);
    expect((await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).levelId).toBeNull();
    const [correctQuestion, incorrectQuestion] = session.questions;
    const correctAnswer = await correctAnswerFor(session.id, correctQuestion.id);
    const incorrectAnswer = await correctAnswerFor(session.id, incorrectQuestion.id);
    await submitPracticeAnswer(user.id, session.id, correctQuestion.id, correctAnswer, "wrong-correct-key");
    await submitPracticeAnswer(user.id, session.id, incorrectQuestion.id, ["A", "B"].filter((id) => !incorrectAnswer.includes(id)), "wrong-incorrect-key");
    expect(await prisma.studentLevelQuestionState.findUniqueOrThrow({ where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: correctQuestion.id } } })).toMatchObject({ state: "REVIEW", wrongCount: 1, correctCount: 1, lastResult: "CORRECT" });
    expect(await prisma.studentLevelQuestionState.findUniqueOrThrow({ where: { userId_levelId_questionId: { userId: user.id, levelId: level.id, questionId: incorrectQuestion.id } } })).toMatchObject({ state: "RELEARNING", wrongCount: 2, correctCount: 0, lastResult: "INCORRECT" });
  });

  it("creates sequential practice with every active question in natural order without reading count rules", async () => {
    const user = await prisma.user.create({ data: { username: "order-user", displayName: "Order User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.1.1", name: "Order Point", path: "/9/9.1/9.1.1", depth: 2 } });
    await Promise.all(["A10", "A2", "A1"].map((code) => prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: code, stem: code, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });

    const session = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });

    expect(session.mode).toBe("QUESTION_ORDER");
    expect(session.questions.map((question) => question.externalQuestionCode)).toEqual(["A1", "A2", "A10"]);
    expect(session.total).toBe(3);
    expect(session.sequentialProgress).toMatchObject({ lastIndex: 0, roundCount: 0 });
  });

  it("persists sequential lastIndex, resumes an active order session, and increments roundCount on completion", async () => {
    const user = await prisma.user.create({ data: { username: "order-progress-user", displayName: "Order Progress User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.1.2", name: "Order Progress Point", path: "/9/9.1/9.1.2", depth: 2 } });
    const questions = await Promise.all(["P1", "P2", "P3"].map((code) => prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: code, stem: code, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));

    const first = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });
    expect(first.total).toBe(3);
    await submitPracticeAnswer(user.id, first.id, questions[0].id, ["A"], "order-progress-1");
    await submitPracticeAnswer(user.id, first.id, questions[1].id, ["A"], "order-progress-2");
    expect(await prisma.studentLevelProgress.findUniqueOrThrow({ where: { userId_levelId: { userId: user.id, levelId: level.id } } })).toMatchObject({ lastIndex: 2, roundCount: 0 });

    const resumed = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });
    expect(resumed.id).toBe(first.id);

    await submitPracticeAnswer(user.id, first.id, questions[2].id, ["A"], "order-progress-3");
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: "COMPLETED" });
    expect(await prisma.studentLevelProgress.findUniqueOrThrow({ where: { userId_levelId: { userId: user.id, levelId: level.id } } })).toMatchObject({ lastIndex: 0, roundCount: 1 });

    const nextRound = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });
    expect(nextRound.id).not.toBe(first.id);
    expect(nextRound.questions.map((question) => question.externalQuestionCode)).toEqual(["P1", "P2", "P3"]);
  });

  it("creates random practice from all active questions without a quantity limit, prioritizing unseen questions", async () => {
    const user = await prisma.user.create({ data: { username: "random-user", displayName: "Random User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.2.1", name: "Random Point", path: "/9/9.2/9.2.1", depth: 2 } });
    const questions = await Promise.all(Array.from({ length: 5 }, (_, index) => prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: `R-${index + 1}`, stem: `R-${index + 1}`, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));
    await prisma.studentLevelQuestionState.createMany({ data: [
      { userId: user.id, levelId: level.id, questionId: questions[0].id, reps: 1 },
      { userId: user.id, levelId: level.id, questionId: questions[1].id, reps: 1 },
      { userId: user.id, levelId: level.id, questionId: questions[2].id, reps: 0 },
    ] });

    const session = await createPracticeSession(user.id, { mode: "random", levelCode: "A" });

    expect(session.mode).toBe("RANDOM_ALL");
    expect(session.total).toBe(5);
    expect(new Set(session.questions.map((question) => question.id))).toEqual(new Set(questions.map((question) => question.id)));
    const unseenIds = new Set(questions.slice(2).map((question) => question.id));
    expect(session.questions.slice(0, 3).every((question) => unseenIds.has(question.id))).toBe(true);
    expect(session.questions.slice(3).every((question) => !unseenIds.has(question.id))).toBe(true);
  });

it("advances learning-mode sequential progress without writing learning state and keeps progress when switching modes", async () => {
    const user = await prisma.user.create({ data: { username: "order-learning-mode-user", displayName: "Order Learning Mode User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.1.3", name: "Order Learning Mode Point", path: "/9/9.1/9.1.3", depth: 2 } });
    const questions = await Promise.all(["L1", "L2", "L3"].map((code) => prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: code, stem: code, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));

    const session = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });
    expect(session.learningMode).toBe(false);

    await updatePracticeSessionLearningMode(user.id, session.id, true);
    expect((await getPracticeSession(user.id, session.id))?.learningMode).toBe(true);

    // Wrong answer in learning mode: no FSRS state or wrong-question side effects, only position advances.
    await submitPracticeAnswer(user.id, session.id, questions[0].id, ["B"], "learning-mode-1");
    expect(await prisma.studentLevelQuestionState.count({ where: { userId: user.id, levelId: level.id } })).toBe(0);
    expect(await prisma.wrongQuestion.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.studentLevelProgress.findUniqueOrThrow({ where: { userId_levelId: { userId: user.id, levelId: level.id } } })).toMatchObject({ lastIndex: 1, roundCount: 0 });

    // Switching back to practice mode mid-round keeps the same session and progress.
    await updatePracticeSessionLearningMode(user.id, session.id, false);
    await submitPracticeAnswer(user.id, session.id, questions[1].id, ["A"], "learning-mode-2");
    expect(await prisma.studentLevelQuestionState.count({ where: { userId: user.id, levelId: level.id } })).toBe(1);
    expect(await prisma.studentLevelProgress.findUniqueOrThrow({ where: { userId_levelId: { userId: user.id, levelId: level.id } } })).toMatchObject({ lastIndex: 2, roundCount: 0 });

    // Completing a round in learning mode still increments the round without RPG rewards.
    await updatePracticeSessionLearningMode(user.id, session.id, true);
    await submitPracticeAnswer(user.id, session.id, questions[2].id, ["A"], "learning-mode-3");
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ status: "COMPLETED" });
    expect(await prisma.studentLevelProgress.findUniqueOrThrow({ where: { userId_levelId: { userId: user.id, levelId: level.id } } })).toMatchObject({ lastIndex: 0, roundCount: 1 });
    expect(await prisma.studentLevelQuestionState.count({ where: { userId: user.id, levelId: level.id } })).toBe(1);
    expect(await prisma.playerProfile.count({ where: { userId: user.id } })).toBe(0);
  });

  it("keeps each practice session's frozen option order after reload", async () => {
    const user = await prisma.user.create({ data: { username: "option-order-user", displayName: "Option Order User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.2.2", name: "Option Order Point", path: "/9/9.2/9.2.2", depth: 2 } });
    const options = ["A", "B", "C", "D"].map((id) => ({ id, text: `Option ${id}` }));
    const randomized = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "ORDER-RANDOM", stem: "Randomized", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", options, correctOptionIds: ["A"] } });
    const preserved = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "ORDER-PRESERVED", stem: "Preserved", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", preserveOptionOrder: true, options, correctOptionIds: ["A"] } });
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 2, multipleCount: 0 } });

    const created = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });
    const reloaded = await getPracticeSession(user.id, created.id);

    expect(reloaded?.questions.map((question) => ({ id: question.id, options: question.options }))).toEqual(created.questions.map((question) => ({ id: question.id, options: question.options })));
    expect(created.questions.find((question) => question.id === preserved.id)?.options).toEqual(options);
    expect(created.questions.find((question) => question.id === randomized.id)?.options.map((option) => option.id).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("snapshots and grades a timed mock exam on final submission", async () => {
    const user = await prisma.user.create({ data: { username: "exam-user", displayName: "Exam User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "9.3.1", name: "Exam Point", path: "/9/9.3/9.3.1", depth: 2 } });
    const single = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "E-1", stem: "Single", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const multiple = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "E-2", stem: "Multiple", type: "MULTIPLE_CHOICE", optionCount: 3, correctOptionCount: 2, selectionSpec: "3选2", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], correctOptionIds: ["A", "C"] } });
    await createDefaultMockBlueprint(level.id, point.id, 1, 1);

    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: "A" });
    const reloaded = await getPracticeSession(user.id, session.id);
    const singleAnswer = await correctAnswerFor(session.id, single.id);
    const multipleAnswer = await correctAnswerFor(session.id, multiple.id);
    const submission = await submitMockExam(user.id, session.id, [{ questionId: single.id, selectedOptionIds: singleAnswer }, { questionId: multiple.id, selectedOptionIds: multipleAnswer.slice(0, 1) }]);

    expect(session.exam).toMatchObject({ durationMinutes: 40, passingCount: 1 });
    expect(reloaded?.questions.map((question) => ({ id: question.id, options: question.options }))).toEqual(session.questions.map((question) => ({ id: question.id, options: question.options })));
    expect(submission).toMatchObject({ correctCount: 1, total: 2, passingCount: 1, passed: true, settlementSource: "STUDENT_SUBMISSION" });
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ status: "COMPLETED", durationMinutesSnapshot: 40, passingCountSnapshot: 1, correctCount: 1, examSettlementSource: "STUDENT_SUBMISSION" });
  });

  it("draws mock exam questions from blueprint item subtrees and ignores favorite/ignored flags", async () => {
    const user = await prisma.user.create({ data: { username: "blueprint-subtree-user", displayName: "Blueprint Subtree User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const root = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE", name: "Blueprint Root", path: "/blue/blueprint", depth: 0 } });
    const childA = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE.1", name: "Child A", path: "/blue/blueprint/blue.1", depth: 1, parentId: root.id } });
    const childB = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE.2", name: "Child B", path: "/blue/blueprint/blue.2", depth: 1, parentId: root.id } });
    const outsidePoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE.OUT", name: "Outside Point", path: "/blue/outside", depth: 0 } });
    const single1 = await prisma.question.create({ data: { knowledgePointId: childA.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-S1", stem: "Blue S1", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const single2 = await prisma.question.create({ data: { knowledgePointId: childA.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-S2", stem: "Blue S2", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const multiple = await prisma.question.create({ data: { knowledgePointId: childB.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-M1", stem: "Blue M1", type: "MULTIPLE_CHOICE", optionCount: 3, correctOptionCount: 2, selectionSpec: "3选2", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], correctOptionIds: ["A", "C"] } });
    const outside = await prisma.question.create({ data: { knowledgePointId: outsidePoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-OUT", stem: "Outside", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await prisma.examBlueprint.create({
      data: {
        levelId: level.id,
        name: "按子树抽题",
        durationMinutes: 40,
        passingCount: 2,
        isDefault: true,
        items: {
          create: [
            { knowledgePointId: childA.id, singleCount: 2, multipleCount: 0 },
            { knowledgePointId: childB.id, singleCount: 0, multipleCount: 1 },
          ],
        },
      },
    });
    await prisma.studentLevelQuestionState.createMany({
      data: [
        { userId: user.id, levelId: level.id, questionId: single1.id, favorite: true },
        { userId: user.id, levelId: level.id, questionId: single2.id, ignored: true },
        { userId: user.id, levelId: level.id, questionId: multiple.id, ignored: true },
      ],
    });

    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });

    expect(session.questions).toHaveLength(3);
    expect(new Set(session.questions.map((question) => question.id))).toEqual(new Set([single1.id, single2.id, multiple.id]));
    expect(session.questions.some((question) => question.id === outside.id)).toBe(false);
  });

  it("uses the requested non-default blueprint when creating a mock exam", async () => {
    const user = await prisma.user.create({ data: { username: "blueprint-selected-user", displayName: "Blueprint Selected User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const defaultPoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE.D", name: "Default Point", path: "/blue/default", depth: 0 } });
    const selectedPoint = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE.S", name: "Selected Point", path: "/blue/selected", depth: 0 } });
    const defaultQuestion = await prisma.question.create({ data: { knowledgePointId: defaultPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-DEF", stem: "Default Question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const selectedQuestion = await prisma.question.create({ data: { knowledgePointId: selectedPoint.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-SEL", stem: "Selected Question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await prisma.examBlueprint.create({ data: { levelId: level.id, name: "默认模拟测试", durationMinutes: 40, passingCount: 1, isDefault: true, items: { create: [{ knowledgePointId: defaultPoint.id, singleCount: 1, multipleCount: 0 }] } } });
    const selectedBlueprint = await prisma.examBlueprint.create({ data: { levelId: level.id, name: "提高卷", durationMinutes: 40, passingCount: 1, isDefault: false, items: { create: [{ knowledgePointId: selectedPoint.id, singleCount: 1, multipleCount: 0 }] } } });

    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code, blueprintId: selectedBlueprint.id });

    expect(session.questions.map((question) => question.id)).toEqual([selectedQuestion.id]);
    expect(session.questions.some((question) => question.id === defaultQuestion.id)).toBe(false);
  });

  it("blocks mock exam creation when blueprint inventory is insufficient", async () => {
    const user = await prisma.user.create({ data: { username: "blueprint-insufficient-user", displayName: "Blueprint Insufficient User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    await prisma.user.update({ where: { id: user.id }, data: { activeLevelId: level.id } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
    const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "BLUE.I", name: "Inventory Point", path: "/blue/inventory", depth: 0 } });
    await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "BLUE-INS", stem: "Only One", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await createDefaultMockBlueprint(level.id, point.id, 2, 0);

    await expect(createPracticeSession(user.id, { mode: "exam", levelCode: level.code })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Inventory Point"),
    });
  });

  it("settles expired mock exams from drafts without exposing answer keys", async () => {
    const { user, level, point, question } = await createBaseRecords();
    await createDefaultMockBlueprint(level.id, point.id, 1, 0);
    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });
    await saveExamDraft(user.id, session.id, { answers: { [question.id]: await correctAnswerFor(session.id, question.id) }, currentIndex: 0, version: 0 });
    await prisma.practiceSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });

    const [firstScan, secondScan] = await Promise.all([settleExpiredMockExams(), settleExpiredMockExams()]);
    const reloaded = await getPracticeSession(user.id, session.id);
    const replay = await submitMockExam(user.id, session.id, []);

    expect(firstScan + secondScan).toBeGreaterThanOrEqual(1);
    expect(reloaded?.initialResults).toEqual({});
    expect(reloaded?.examResult).toMatchObject({ correctCount: 1, total: 1, passed: true, settlementSource: "AUTO_SETTLEMENT" });
    expect(JSON.stringify(reloaded)).not.toContain("correctOptionIds");
    expect(replay).toEqual(reloaded?.examResult);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ status: "COMPLETED", examSettlementSource: "AUTO_SETTLEMENT" });
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
  });

  it("abandons an active mock exam without grading it or updating wrong questions", async () => {
    const { user, level, point, question } = await createBaseRecords();
    await createDefaultMockBlueprint(level.id, point.id, 1, 0);
    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });
    await saveExamDraft(user.id, session.id, { answers: { [question.id]: ["B"] }, currentIndex: 0, version: 0 });

    await expect(abandonMockExam(user.id, session.id)).resolves.toEqual({ abandoned: true });
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ status: "ABANDONED", correctCount: 0 });
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(0);
    expect(await prisma.wrongQuestion.count({ where: { userId: user.id, questionId: question.id } })).toBe(0);
  });

  it("uses completed sessions only for teacher statistics across mixed session states", async () => {
    const { user, level, point, question } = await createBaseRecords();
    const teacher = await prisma.user.create({ data: { username: "stats-teacher", displayName: "Stats Teacher", passwordHash: "test", role: "TEACHER" } });
    const now = new Date();
    const completedAt = new Date(now.getTime() - 60_000);
    const completed = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0, status: "COMPLETED", correctCount: 1, startedAt: completedAt, completedAt } });
    await prisma.practiceSessionQuestion.create({ data: { sessionId: completed.id, questionId: question.id, position: 0, snapshot: { questionId: question.id, levelId: level.id, knowledgePointId: point.id, stem: question.stem, type: question.type, optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: question.options, correctOptionIds: ["A"], levelCode: level.code, knowledgeName: point.name } } });
    await prisma.practiceAnswer.create({ data: { sessionId: completed.id, questionId: question.id, selectedOptionIds: ["A"], isCorrect: true, submittedAt: completedAt } });
    await prisma.practiceSession.create({ data: { userId: user.id, mode: "MOCK_EXAM", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0, status: "IN_PROGRESS", startedAt: now } });
    await prisma.practiceSession.create({ data: { userId: user.id, mode: "MOCK_EXAM", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0, status: "ABANDONED", startedAt: now, completedAt: now } });
    await prisma.practiceSession.create({ data: { userId: teacher.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0, status: "COMPLETED", correctCount: 1, startedAt: completedAt, completedAt } });

    await expect(getTeacherLearningStatistics(new Date(now.getTime() - 5 * 60_000))).resolves.toMatchObject({
      summary: { completedSessions: 1, activeStudents: 1, answered: 1, correct: 1, accuracy: 100 },
      students: [{ displayName: "Student", completedSessions: 1, answered: 1, correct: 1, accuracy: 100 }],
    });
  });

  it("deletes unused imported questions, archives referenced ones, and prevents repeated revert", async () => {
    const teacher = await prisma.user.create({ data: { username: "revert-teacher", displayName: "Teacher", passwordHash: "test", role: "TEACHER" } });
    const student = await prisma.user.create({ data: { username: "revert-student", displayName: "Student", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "7.1.1", name: "Revert Point", path: "/7/7.1/7.1.1", depth: 2 } });
    const batch = await prisma.importBatch.create({ data: { fileName: "revert.xlsx", importedById: teacher.id, status: "COMMITTED", totalRows: 2, validRows: 2, insertedRows: 2 } });
    const [used, unused] = await Promise.all([
      prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, importBatchId: batch.id, externalQuestionCode: "REVERT-USED", stem: "Used", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
      prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, importBatchId: batch.id, externalQuestionCode: "REVERT-UNUSED", stem: "Unused", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } }),
    ]);
    const session = await prisma.practiceSession.create({ data: { userId: student.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0 } });
    await prisma.practiceSessionQuestion.create({ data: { sessionId: session.id, questionId: used.id, position: 0, snapshot: { questionId: used.id, levelId: level.id, knowledgePointId: point.id, stem: used.stem, type: used.type, optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], levelCode: level.code, knowledgeName: point.name } } });

    expect(await revertImportBatch(batch.id, teacher.id)).toEqual({ archived: 2 });
    expect(await prisma.question.findUnique({ where: { id: unused.id } })).toMatchObject({ status: "ARCHIVED" });
    expect(await prisma.question.findUniqueOrThrow({ where: { id: used.id } })).toMatchObject({ status: "ARCHIVED" });
    expect(await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({ status: "REVERTED" });
    await expect(revertImportBatch(batch.id, teacher.id)).rejects.toMatchObject({ status: 409 });
  });

  it("replays a same-key practice answer without duplicate settlement and rejects replacement", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });
    const session = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });

    const answer = await correctAnswerFor(session.id, question.id);
    const wrongAnswer = ["A", "B"].filter((id) => !answer.includes(id));
    const accepted = await submitPracticeAnswer(user.id, session.id, question.id, answer, "retry-key");
    const replayed = await submitPracticeAnswer(user.id, session.id, question.id, answer, "retry-key-retry");

    expect(replayed).toEqual(accepted);
    await expect(submitPracticeAnswer(user.id, session.id, question.id, wrongAnswer, "replacement-key")).rejects.toMatchObject({ status: 409, message: "本题答案已接受，不能覆盖" });
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await prisma.wrongQuestion.count({ where: { userId: user.id, questionId: question.id } })).toBe(0);
    await expect(prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).resolves.toMatchObject({ currentIndex: 1, correctCount: 1, status: "COMPLETED" });
  });

  it("settles concurrent retries of the same answer once", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });
    const session = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });

    const answer = await correctAnswerFor(session.id, question.id);
    const results = await Promise.all([
      submitPracticeAnswer(user.id, session.id, question.id, answer, "concurrent-retry-key"),
      submitPracticeAnswer(user.id, session.id, question.id, answer, "concurrent-retry-key"),
    ]);

    expect(results[1]).toEqual(results[0]);
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ currentIndex: 1, correctCount: 1, status: "COMPLETED" });
  });

  it("accepts at most one answer when different answers race", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });
    const session = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });

    const correctAnswer = await correctAnswerFor(session.id, question.id);
    const wrongAnswer = ["A", "B"].filter((id) => !correctAnswer.includes(id));
    const results = await Promise.allSettled([
      submitPracticeAnswer(user.id, session.id, question.id, correctAnswer, "concurrent-a"),
      submitPracticeAnswer(user.id, session.id, question.id, wrongAnswer, "concurrent-b"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const answer = await prisma.practiceAnswer.findUniqueOrThrow({ where: { sessionId_questionId: { sessionId: session.id, questionId: question.id } } });
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(answer.selectedOptionIds).toEqual(expect.arrayContaining([expect.stringMatching(/^[AB]$/)]));
    expect(await prisma.wrongQuestion.findUnique({ where: { userId_questionId: { userId: user.id, questionId: question.id } } })).toEqual(answer.isCorrect ? null : expect.objectContaining({ wrongCount: 1, mastered: false }));
  });

  it("persists and resumes versioned mock exam drafts without exposing grading data", async () => {
    const { user, level, point, question } = await createBaseRecords();
    const second = await prisma.question.create({ data: { knowledgePointId: point.id, levels: { create: { levelId: level.id } }, externalQuestionCode: "Q-2", stem: "Second", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["B"] } });
    await createDefaultMockBlueprint(level.id, point.id, 2, 0);
    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });

    const saved = await saveExamDraft(user.id, session.id, { answers: { [question.id]: ["A"] }, currentIndex: 1, version: 0 });
    expect(saved).toMatchObject({ answers: { [question.id]: ["A"] }, currentIndex: 1, version: 1 });
    await expect(saveExamDraft(user.id, session.id, { answers: { [question.id]: ["B"] }, currentIndex: 0, version: 0 })).rejects.toMatchObject({ status: 409 });

    const resumed = await getPracticeSession(user.id, session.id);
    expect(resumed?.draft).toMatchObject({ answers: { [question.id]: ["A"] }, currentIndex: 1, version: 1 });
    expect(resumed?.questions[0]).not.toHaveProperty("correctOptionIds");
    expect(resumed?.initialResults).toEqual({});
    expect(second.id).toBeTruthy();
  });

  it("rejects draft writes after mock exam settlement and removes the draft", async () => {
    const { user, level, point, question } = await createBaseRecords();
    await createDefaultMockBlueprint(level.id, point.id, 1, 0);
    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });
    await saveExamDraft(user.id, session.id, { answers: { [question.id]: ["A"] }, currentIndex: 0, version: 0 });
    await submitMockExam(user.id, session.id, [{ questionId: question.id, selectedOptionIds: ["A"] }]);

    expect(await prisma.examDraft.findUnique({ where: { sessionId: session.id } })).toBeNull();
    await expect(saveExamDraft(user.id, session.id, { answers: {}, currentIndex: 0, version: 1 })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects draft writes after an abandoned mock exam", async () => {
    const { user, level, point, question } = await createBaseRecords();
    await createDefaultMockBlueprint(level.id, point.id, 1, 0);
    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: level.code });
    await prisma.practiceSession.update({ where: { id: session.id }, data: { status: "ABANDONED" } });

    await expect(saveExamDraft(user.id, session.id, { answers: { [question.id]: ["A"] }, currentIndex: 0, version: 0 })).rejects.toMatchObject({ status: 409 });
  });
});
