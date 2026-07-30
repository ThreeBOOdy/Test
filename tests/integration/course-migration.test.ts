import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { createConnection, type Connection } from "mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../generated/prisma/client";
import { getDatabaseName } from "../../lib/domain/database-url";
import { RADIO_COURSE_ID } from "../../lib/domain/course";

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required for integration tests");
const migrationUrl = process.env.COURSE_MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("COURSE_MIGRATION_DATABASE_URL is required for course migration tests");
if (getDatabaseName(migrationUrl) !== "practice_ci_migration") throw new Error("COURSE_MIGRATION_DATABASE_URL must use the practice_ci_migration database");
const migrationConnectionUrl = migrationUrl.replace(/^mysql:/, "mariadb:");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(migrationUrl) });
let connection: Connection;

beforeAll(async () => {
  connection = await createConnection(migrationConnectionUrl);
  await resetDatabase(connection);
  for (const name of ["20260724180000_mysql_init", "20260726110000_student_account_foundation", "20260726120000_student_account_imports", "20260727100000_default_grades"]) {
    await connection.importFile({ file: path.resolve(`prisma/migrations/${name}/migration.sql`) });
  }
  await seedLegacyCourseData(connection);
  await connection.importFile({ file: path.resolve("prisma/migrations/20260730120000_radio_course_boundary/migration.sql") });
});

afterAll(async () => {
  await prisma.$disconnect();
  if (connection) await resetDatabase(connection);
  await connection?.end();
});

describe("RADIO course migration", () => {
  it("preserves legacy records and their relationships", async () => {
    await expect(prisma.course.findMany({ where: { enabled: true }, select: { id: true, code: true } })).resolves.toEqual([{ id: RADIO_COURSE_ID, code: "RADIO" }]);
    await expect(prisma.question.findFirstOrThrow({ where: { id: "legacy-question", courseId: RADIO_COURSE_ID }, include: { level: true, knowledgePoint: true, importBatch: true } })).resolves.toMatchObject({
      id: "legacy-question",
      stem: "Legacy question",
      level: { id: "legacy-level" },
      knowledgePoint: { id: "legacy-point" },
      importBatch: { id: "legacy-batch" },
    });
    await expect(prisma.practiceSession.findFirstOrThrow({ where: { id: "legacy-session", courseId: RADIO_COURSE_ID }, include: { questions: true, answers: true } })).resolves.toMatchObject({
      questions: [{ questionId: "legacy-question", courseId: RADIO_COURSE_ID }],
      answers: [{ questionId: "legacy-question", courseId: RADIO_COURSE_ID, isCorrect: false }],
    });
    await expect(prisma.wrongQuestion.findFirstOrThrow({ where: { id: "legacy-wrong", courseId: RADIO_COURSE_ID } })).resolves.toMatchObject({ questionId: "legacy-question", wrongCount: 2 });
    await expect(prisma.levelPracticeRule.findUniqueOrThrow({ where: { courseId_levelId: { courseId: RADIO_COURSE_ID, levelId: "legacy-level" } }, include: { level: true } })).resolves.toMatchObject({ singleCount: 1, multipleCount: 0, enabled: true, level: { id: "legacy-level", courseId: RADIO_COURSE_ID } });
    await expect(prisma.knowledgePracticeRule.findUniqueOrThrow({ where: { courseId_knowledgePointId_levelId: { courseId: RADIO_COURSE_ID, knowledgePointId: "legacy-point", levelId: "legacy-level" } }, include: { level: true, knowledgePoint: true } })).resolves.toMatchObject({ singleCount: 1, multipleCount: 0, enabled: true, level: { id: "legacy-level", courseId: RADIO_COURSE_ID }, knowledgePoint: { id: "legacy-point", courseId: RADIO_COURSE_ID } });
    await expect(prisma.examRule.findUniqueOrThrow({ where: { courseId_levelId: { courseId: RADIO_COURSE_ID, levelId: "legacy-level" } }, include: { level: true } })).resolves.toMatchObject({ singleCount: 1, multipleCount: 0, durationMinutes: 30, passingCount: 1, enabled: true, level: { id: "legacy-level", courseId: RADIO_COURSE_ID } });
  });

  it("rejects cross-course relationships after migration", async () => {
    const otherCourse = await prisma.course.create({ data: { code: "PYTHON", name: "Python" } });
    const [otherLevel, otherPoint, otherBatch] = await Promise.all([
      prisma.level.create({ data: { courseId: otherCourse.id, code: "P", name: "Python Level" } }),
      prisma.knowledgePoint.create({ data: { courseId: otherCourse.id, code: "1.1", name: "Python Point", path: "/1/1.1", depth: 1 } }),
      prisma.importBatch.create({ data: { courseId: otherCourse.id, fileName: "python.xlsx", importedById: "legacy-user", totalRows: 0, validRows: 0 } }),
    ]);
    const otherQuestion = await prisma.question.create({ data: { courseId: otherCourse.id, levelId: otherLevel.id, knowledgePointId: otherPoint.id, importBatchId: otherBatch.id, stem: "Python question", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } });

    await expect(prisma.levelPracticeRule.create({ data: { courseId: RADIO_COURSE_ID, levelId: otherLevel.id, singleCount: 1, multipleCount: 0 } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.knowledgePracticeRule.create({ data: { courseId: RADIO_COURSE_ID, levelId: "legacy-level", knowledgePointId: otherPoint.id, singleCount: 1, multipleCount: 0 } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.examRule.create({ data: { courseId: RADIO_COURSE_ID, levelId: otherLevel.id, singleCount: 1, multipleCount: 0, durationMinutes: 30, passingCount: 1 } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.question.create({ data: { courseId: RADIO_COURSE_ID, levelId: "legacy-level", knowledgePointId: otherPoint.id, stem: "Cross course point", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.question.create({ data: { courseId: RADIO_COURSE_ID, levelId: "legacy-level", knowledgePointId: "legacy-point", importBatchId: otherBatch.id, stem: "Cross course import", type: "SINGLE_CHOICE", optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"] } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.practiceSession.create({ data: { courseId: RADIO_COURSE_ID, userId: "legacy-user", mode: "LEVEL_COMPREHENSIVE", levelId: otherLevel.id, singleCountSnapshot: 1, multipleCountSnapshot: 0 } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.practiceSessionQuestion.create({ data: { courseId: RADIO_COURSE_ID, sessionId: "legacy-session", questionId: otherQuestion.id, position: 1, snapshot: {} } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.practiceAnswer.create({ data: { courseId: RADIO_COURSE_ID, sessionId: "legacy-session", questionId: otherQuestion.id, selectedOptionIds: ["A"], isCorrect: true } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.wrongQuestion.create({ data: { courseId: RADIO_COURSE_ID, userId: "legacy-user", questionId: otherQuestion.id } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("allows a future course to replace RADIO as the sole enabled course", async () => {
    const nextCourse = await prisma.course.create({ data: { code: "PYTHON_NEXT", name: "Python Next" } });

    await expect(prisma.course.create({ data: { code: "SECOND_ACTIVE", name: "Second Active", enabled: true, activeSlot: 1 } })).rejects.toMatchObject({ code: "P2002" });
    await prisma.$transaction([
      prisma.course.update({ where: { id: RADIO_COURSE_ID }, data: { enabled: false, activeSlot: null } }),
      prisma.course.update({ where: { id: nextCourse.id }, data: { enabled: true, activeSlot: 1 } }),
    ]);

    await expect(prisma.course.findMany({ where: { enabled: true }, select: { id: true, code: true } })).resolves.toEqual([{ id: nextCourse.id, code: "PYTHON_NEXT" }]);
  });
});

async function resetDatabase(database: Connection) {
  await database.query("SET FOREIGN_KEY_CHECKS = 0");
  const tables = await database.query<Array<{ tableName: string }>>("SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
  for (const table of tables) await database.query(`DROP TABLE IF EXISTS \`${table.tableName.replaceAll("`", "``")}\``);
  await database.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function seedLegacyCourseData(database: Connection) {
  const now = new Date("2026-07-29T00:00:00.000Z");
  await database.query("INSERT INTO `User` (`id`,`username`,`displayName`,`passwordHash`,`role`,`enabled`,`mustChangePassword`,`sessionVersion`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?,?,?,?)", ["legacy-user", "legacy-user", "Legacy User", "test", "STUDENT", true, false, 0, now, now]);
  await database.query("INSERT INTO `Level` (`id`,`code`,`name`,`sortOrder`,`enabled`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?)", ["legacy-level", "A", "A Level", 0, true, now, now]);
  await database.query("INSERT INTO `KnowledgePoint` (`id`,`code`,`name`,`path`,`depth`,`sortOrder`,`enabled`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?,?,?)", ["legacy-point", "1.1", "Legacy Point", "/1/1.1", 1, 0, true, now, now]);
  await database.query("INSERT INTO `LevelPracticeRule` (`id`,`levelId`,`singleCount`,`multipleCount`,`enabled`,`updatedAt`) VALUES (?,?,?,?,?,?)", ["legacy-level-rule", "legacy-level", 1, 0, true, now]);
  await database.query("INSERT INTO `KnowledgePracticeRule` (`id`,`knowledgePointId`,`levelId`,`singleCount`,`multipleCount`,`enabled`,`updatedAt`) VALUES (?,?,?,?,?,?,?)", ["legacy-knowledge-rule", "legacy-point", "legacy-level", 1, 0, true, now]);
  await database.query("INSERT INTO `ExamRule` (`id`,`levelId`,`singleCount`,`multipleCount`,`durationMinutes`,`passingCount`,`enabled`,`updatedAt`) VALUES (?,?,?,?,?,?,?,?)", ["legacy-exam-rule", "legacy-level", 1, 0, 30, 1, true, now]);
  await database.query("INSERT INTO `ImportBatch` (`id`,`fileName`,`status`,`totalRows`,`validRows`,`insertedRows`,`importedById`,`createdAt`) VALUES (?,?,?,?,?,?,?,?)", ["legacy-batch", "legacy.xlsx", "COMMITTED", 1, 1, 1, "legacy-user", now]);
  await database.query("INSERT INTO `Question` (`id`,`levelId`,`knowledgePointId`,`externalQuestionCode`,`stem`,`type`,`optionCount`,`correctOptionCount`,`selectionSpec`,`options`,`correctOptionIds`,`status`,`importBatchId`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", ["legacy-question", "legacy-level", "legacy-point", "Q-1", "Legacy question", "SINGLE_CHOICE", 2, 1, "2选1", JSON.stringify([{ id: "A", text: "A" }, { id: "B", text: "B" }]), JSON.stringify(["A"]), "ACTIVE", "legacy-batch", now, now]);
  await database.query("INSERT INTO `PracticeSession` (`id`,`userId`,`mode`,`levelId`,`status`,`singleCountSnapshot`,`multipleCountSnapshot`,`currentIndex`,`correctCount`,`startedAt`,`completedAt`) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ["legacy-session", "legacy-user", "LEVEL_COMPREHENSIVE", "legacy-level", "COMPLETED", 1, 0, 1, 0, now, now]);
  await database.query("INSERT INTO `PracticeSessionQuestion` (`id`,`sessionId`,`questionId`,`position`,`snapshot`) VALUES (?,?,?,?,?)", ["legacy-session-question", "legacy-session", "legacy-question", 0, JSON.stringify({ questionId: "legacy-question", stem: "Legacy question" })]);
  await database.query("INSERT INTO `PracticeAnswer` (`id`,`sessionId`,`questionId`,`selectedOptionIds`,`isCorrect`,`submittedAt`) VALUES (?,?,?,?,?,?)", ["legacy-answer", "legacy-session", "legacy-question", JSON.stringify(["B"]), false, now]);
  await database.query("INSERT INTO `WrongQuestion` (`id`,`userId`,`questionId`,`wrongCount`,`mastered`,`lastWrongAt`) VALUES (?,?,?,?,?,?)", ["legacy-wrong", "legacy-user", "legacy-question", 2, false, now]);
}
