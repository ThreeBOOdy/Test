import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { commitImportBatch, getImportBatchReport, revertImportBatch } from "../../lib/server/import-service";
import { createPracticeSession, getPracticeSession, submitMockExam, submitPracticeAnswer } from "../../lib/server/practice-service";
import { createSession, findSessionUser, revokeSession, revokeUserSessions } from "../../lib/server/session";
import { RADIO_COURSE_ID } from "../../lib/domain/course";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

beforeAll(() => {
  assertDatabaseName(connectionString, "practice_ci_integration");
});

beforeEach(async () => {
  await prisma.authSession.deleteMany();
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentReviewRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  await prisma.level.deleteMany();
  await prisma.course.deleteMany({ where: { id: { not: RADIO_COURSE_ID } } });
  await prisma.user.deleteMany();
  await prisma.grade.deleteMany();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const deleted = await prisma.knowledgePoint.deleteMany({ where: { children: { none: {} } } });
    if (!deleted.count) throw new Error("Unable to delete knowledge point tree");
  }
}

async function createBaseRecords() {
  const user = await prisma.user.create({ data: { username: "student", displayName: "Student", passwordHash: "test", role: "STUDENT" } });
  const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
  const point = await prisma.knowledgePoint.create({ data: { code: "1.1", name: "Point", path: "/1/1.1", depth: 1 } });
  const question = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "Q-1", stem: "Original", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
  return { user, level, point, question };
}

describe("production database foundation", () => {
  it("keeps RADIO as the sole enabled course", async () => {
    const nextCourse = await prisma.course.create({ data: { code: "PYTHON", name: "Python" } });

    await expect(prisma.course.create({ data: { code: "SECOND_ACTIVE", name: "Second Active", enabled: true, activeSlot: 1 } })).rejects.toMatchObject({ code: "P2039" });
    await expect(prisma.course.update({ where: { id: RADIO_COURSE_ID }, data: { enabled: false, activeSlot: null } })).rejects.toMatchObject({ code: "P2039" });
    await expect(prisma.course.update({ where: { id: nextCourse.id }, data: { enabled: true, activeSlot: 1 } })).rejects.toMatchObject({ code: "P2039" });

    await expect(prisma.course.findMany({ where: { enabled: true }, select: { id: true } })).resolves.toEqual([{ id: RADIO_COURSE_ID }]);
  });

  it("rejects cross-course question ownership", async () => {
    const otherCourse = await prisma.course.create({ data: { code: "PYTHON", name: "Python" } });
    const radioLevel = await prisma.level.create({ data: { courseId: RADIO_COURSE_ID, code: "A", name: "Radio A" } });
    const otherPoint = await prisma.knowledgePoint.create({ data: { courseId: otherCourse.id, code: "1.1", name: "Python Point", path: "/1/1.1", depth: 1 } });

    await expect(prisma.question.create({ data: { courseId: RADIO_COURSE_ID, levelId: radioLevel.id, knowledgePointId: otherPoint.id, stem: "Cross course", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps practice selection inside the RADIO course boundary", async () => {
    const otherCourse = await prisma.course.create({ data: { code: "PYTHON", name: "Python" } });
    const user = await prisma.user.create({ data: { username: "course-student", displayName: "Course Student", passwordHash: "test", role: "STUDENT" } });
    const radioLevel = await prisma.level.create({ data: { courseId: RADIO_COURSE_ID, code: "A", name: "Radio A" } });
    const otherLevel = await prisma.level.create({ data: { courseId: otherCourse.id, code: "A", name: "Python A" } });
    const radioPoint = await prisma.knowledgePoint.create({ data: { courseId: RADIO_COURSE_ID, code: "1.1", name: "Radio Point", path: "/1/1.1", depth: 1 } });
    const otherPoint = await prisma.knowledgePoint.create({ data: { courseId: otherCourse.id, code: "1.1", name: "Python Point", path: "/1/1.1", depth: 1 } });
    await prisma.levelPracticeRule.create({ data: { courseId: RADIO_COURSE_ID, levelId: radioLevel.id, singleCount: 1, multipleCount: 0 } });
    await prisma.levelPracticeRule.create({ data: { courseId: otherCourse.id, levelId: otherLevel.id, singleCount: 1, multipleCount: 0 } });
    const radioQuestion = await prisma.question.create({ data: { courseId: RADIO_COURSE_ID, levelId: radioLevel.id, knowledgePointId: radioPoint.id, externalQuestionCode: "Q-1", stem: "Radio", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    await prisma.question.create({ data: { courseId: otherCourse.id, levelId: otherLevel.id, knowledgePointId: otherPoint.id, externalQuestionCode: "Q-1", stem: "Python", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });

    const session = await createPracticeSession(user.id, { mode: "level", levelCode: "A", courseId: otherCourse.id } as Parameters<typeof createPracticeSession>[1]);

    expect(session.questions.map((question) => question.id)).toEqual([radioQuestion.id]);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ courseId: RADIO_COURSE_ID, levelId: radioLevel.id });
  });

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

    const answer = await prisma.practiceAnswer.findUniqueOrThrow({ where: { courseId_sessionId_questionId: { courseId: RADIO_COURSE_ID, sessionId: session.id, questionId: question.id } } });
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
    await expect(prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "Q-1", stem: "Duplicate", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })).rejects.toBeTruthy();
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
    const point = await prisma.knowledgePoint.create({ data: { code: "9.1.1", name: "Bulk Point", path: "/9/9.1/9.1.1", depth: 2 } });
    await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "BULK-1", stem: "Question 1", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }, { id: "D", text: "D" }], correctOptionIds: ["A"] } });
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
    const point = await prisma.knowledgePoint.create({ data: { code: "8.1.1", name: "Race Point", path: "/8/8.1/8.1.1", depth: 2 } });
    const batch = await prisma.importBatch.create({ data: { fileName: "race.xlsx", importedById: teacher.id, totalRows: 1, validRows: 1, expiresAt: new Date(Date.now() + 60_000) } });
    const payload = { rowNumber: 2, levelCode: "A", categoryCode: "8.1.1", knowledgePointName: "Race Point", externalQuestionCode: "RACE-1", stem: "Race question", rawAnswer: "A", declaredSelectionSpec: "2选1", optionValues: { A: "A", B: "B" }, enabled: true };
    await prisma.importBatchRow.create({ data: { batchId: batch.id, rowNumber: 2, payload, issues: [], valid: true } });
    await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "RACE-1", stem: "Conflicting concurrent question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });

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

    const result = await submitPracticeAnswer(user.id, created.id, question.id, ["A"], "snapshot-answer-key");
    expect(result.isCorrect).toBe(true);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: "COMPLETED", currentIndex: 1, correctCount: 1 });
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
    await submitPracticeAnswer(user.id, session.id, correctQuestion.id, ["A"], "wrong-correct-key");
    await submitPracticeAnswer(user.id, session.id, incorrectQuestion.id, ["B"], "wrong-incorrect-key");
    expect(await prisma.wrongQuestion.findUniqueOrThrow({ where: { courseId_userId_questionId: { courseId: RADIO_COURSE_ID, userId: user.id, questionId: correctQuestion.id } } })).toMatchObject({ mastered: true, wrongCount: 1 });
    expect(await prisma.wrongQuestion.findUniqueOrThrow({ where: { courseId_userId_questionId: { courseId: RADIO_COURSE_ID, userId: user.id, questionId: incorrectQuestion.id } } })).toMatchObject({ mastered: false, wrongCount: 2 });
  });

  it("creates sequential practice in strict natural question-number order", async () => {
    const user = await prisma.user.create({ data: { username: "order-user", displayName: "Order User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "9.1.1", name: "Order Point", path: "/9/9.1/9.1.1", depth: 2 } });
    const questions = await Promise.all(["A10", "A2", "A1"].map((code) => prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: code, stem: code, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 2, multipleCount: 0 } });
    const answeredSession = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 1, multipleCountSnapshot: 0, status: "COMPLETED", completedAt: new Date() } });
    await prisma.practiceAnswer.create({ data: { sessionId: answeredSession.id, questionId: questions.find((question) => question.externalQuestionCode === "A1")!.id, selectedOptionIds: ["A"], isCorrect: true } });

    const session = await createPracticeSession(user.id, { mode: "order", levelCode: "A" });

    expect(session.mode).toBe("QUESTION_ORDER");
    expect(session.questions.map((question) => question.externalQuestionCode)).toEqual(["A1", "A2"]);
  });

  it("fills random practice entirely from unanswered questions when enough are available", async () => {
    const user = await prisma.user.create({ data: { username: "random-user", displayName: "Random User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "9.2.1", name: "Random Point", path: "/9/9.2/9.2.1", depth: 2 } });
    const questions = await Promise.all(Array.from({ length: 5 }, (_, index) => prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: `R-${index + 1}`, stem: `R-${index + 1}`, type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })));
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 3, multipleCount: 0 } });
    const answeredSession = await prisma.practiceSession.create({ data: { userId: user.id, mode: "LEVEL_COMPREHENSIVE", levelId: level.id, singleCountSnapshot: 2, multipleCountSnapshot: 0, status: "COMPLETED", completedAt: new Date() } });
    await prisma.practiceAnswer.createMany({ data: questions.slice(0, 2).map((question) => ({ sessionId: answeredSession.id, questionId: question.id, selectedOptionIds: ["A"], isCorrect: true })) });

    const session = await createPracticeSession(user.id, { mode: "random", levelCode: "A" });

    expect(session.mode).toBe("RANDOM_ALL");
    expect(new Set(session.questions.map((question) => question.id))).toEqual(new Set(questions.slice(2).map((question) => question.id)));
  });

  it("keeps each practice session's frozen option order after reload", async () => {
    const user = await prisma.user.create({ data: { username: "option-order-user", displayName: "Option Order User", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const point = await prisma.knowledgePoint.create({ data: { code: "9.2.2", name: "Option Order Point", path: "/9/9.2/9.2.2", depth: 2 } });
    const options = ["A", "B", "C", "D"].map((id) => ({ id, text: `Option ${id}` }));
    const randomized = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "ORDER-RANDOM", stem: "Randomized", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", options, correctOptionIds: ["A"] } });
    const preserved = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "ORDER-PRESERVED", stem: "Preserved", type: "SINGLE_CHOICE", optionCount: 4, correctOptionCount: 1, selectionSpec: "4选1", preserveOptionOrder: true, options, correctOptionIds: ["A"] } });
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
    const point = await prisma.knowledgePoint.create({ data: { code: "9.3.1", name: "Exam Point", path: "/9/9.3/9.3.1", depth: 2 } });
    const single = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "E-1", stem: "Single", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });
    const multiple = await prisma.question.create({ data: { levelId: level.id, knowledgePointId: point.id, externalQuestionCode: "E-2", stem: "Multiple", type: "MULTIPLE_CHOICE", optionCount: 3, correctOptionCount: 2, selectionSpec: "3选2", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], correctOptionIds: ["A", "C"] } });
    await prisma.examRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 1, durationMinutes: 40, passingCount: 1 } });

    const session = await createPracticeSession(user.id, { mode: "exam", levelCode: "A" });
    const reloaded = await getPracticeSession(user.id, session.id);
    const submission = await submitMockExam(user.id, session.id, [{ questionId: single.id, selectedOptionIds: ["A"] }, { questionId: multiple.id, selectedOptionIds: ["A"] }]);

    expect(session.exam).toMatchObject({ durationMinutes: 40, passingCount: 1 });
    expect(reloaded?.questions.map((question) => ({ id: question.id, options: question.options }))).toEqual(session.questions.map((question) => ({ id: question.id, options: question.options })));
    expect(submission).toMatchObject({ correctCount: 1, total: 2, passingCount: 1, passed: true });
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ status: "COMPLETED", durationMinutesSnapshot: 40, passingCountSnapshot: 1, correctCount: 1 });
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

    expect(await revertImportBatch(batch.id, teacher.id)).toEqual({ archived: 1, deleted: 1 });
    expect(await prisma.question.findUnique({ where: { id: unused.id } })).toBeNull();
    expect(await prisma.question.findUniqueOrThrow({ where: { id: used.id } })).toMatchObject({ status: "ARCHIVED" });
    expect(await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({ status: "REVERTED" });
    await expect(revertImportBatch(batch.id, teacher.id)).rejects.toMatchObject({ status: 409 });
  });

  it("replays a same-key practice answer without duplicate settlement and rejects replacement", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });
    const session = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });

    const accepted = await submitPracticeAnswer(user.id, session.id, question.id, ["A"], "retry-key");
    const replayed = await submitPracticeAnswer(user.id, session.id, question.id, ["A"], "retry-key-retry");

    expect(replayed).toEqual(accepted);
    await expect(submitPracticeAnswer(user.id, session.id, question.id, ["B"], "replacement-key")).rejects.toMatchObject({ status: 409, message: "本题答案已接受，不能覆盖" });
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await prisma.wrongQuestion.count({ where: { userId: user.id, questionId: question.id } })).toBe(0);
    await expect(prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).resolves.toMatchObject({ currentIndex: 1, correctCount: 1, status: "COMPLETED" });
  });

  it("settles concurrent retries of the same answer once", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });
    const session = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });

    const results = await Promise.all([
      submitPracticeAnswer(user.id, session.id, question.id, ["A"], "concurrent-retry-key"),
      submitPracticeAnswer(user.id, session.id, question.id, ["A"], "concurrent-retry-key"),
    ]);

    expect(results[1]).toEqual(results[0]);
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await prisma.practiceSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ currentIndex: 1, correctCount: 1, status: "COMPLETED" });
  });

  it("accepts at most one answer when different answers race", async () => {
    const { user, level, question } = await createBaseRecords();
    await prisma.levelPracticeRule.create({ data: { levelId: level.id, singleCount: 1, multipleCount: 0 } });
    const session = await createPracticeSession(user.id, { mode: "level", levelCode: level.code });

    const results = await Promise.allSettled([
      submitPracticeAnswer(user.id, session.id, question.id, ["A"], "concurrent-a"),
      submitPracticeAnswer(user.id, session.id, question.id, ["B"], "concurrent-b"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const answer = await prisma.practiceAnswer.findUniqueOrThrow({ where: { courseId_sessionId_questionId: { courseId: RADIO_COURSE_ID, sessionId: session.id, questionId: question.id } } });
    expect(await prisma.practiceAnswer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(answer.selectedOptionIds).toEqual(expect.arrayContaining([expect.stringMatching(/^[AB]$/)]));
    expect(await prisma.wrongQuestion.findUnique({ where: { courseId_userId_questionId: { courseId: RADIO_COURSE_ID, userId: user.id, questionId: question.id } } })).toEqual(answer.isCorrect ? null : expect.objectContaining({ wrongCount: 1, mastered: false }));
  });
});
