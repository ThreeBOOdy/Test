import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertDatabaseName, getDatabaseName } from "../lib/domain/database-url";
import { parseJsonStringArray } from "../lib/domain/json-string-array";

describe("MySQL project configuration", () => {
  it("uses the MySQL Prisma provider and adapter only", () => {
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
    const packageJson = fs.readFileSync(path.resolve("package.json"), "utf8");
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260724180000_mysql_init/migration.sql"), "utf8");
    const migrationLock = fs.readFileSync(path.resolve("prisma/migrations/migration_lock.toml"), "utf8");

    expect(schema).toContain('provider = "mysql"');
    expect(schema).not.toContain('provider = "postgresql"');
    expect(packageJson).toContain('"@prisma/adapter-mariadb"');
    expect(packageJson).not.toContain('"@prisma/adapter-pg"');
    expect(packageJson).not.toContain('"pg"');
    expect(migrationLock).toContain('provider = "mysql"');
    expect(migration).toContain("`correctOptionIds` JSON NOT NULL");
    expect(migration).toContain("`selectedOptionIds` JSON NOT NULL");
    expect(migration).toContain("`stem` TEXT NOT NULL");
    expect(migration).toContain("utf8mb4_0900_ai_ci");
  });

  it("defines the student account foundation migration safely", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260726110000_student_account_foundation/migration.sql"), "utf8");

    expect(migration).toContain("ENUM('STUDENT', 'TEACHER', 'ADMIN')");
    expect(migration).toContain("CREATE TABLE `Grade`");
    expect(migration).toContain("CREATE TABLE `StudentReviewRecord`");
    expect(migration).toContain("`nationalIdEncrypted` TEXT NULL");
    expect(migration).toContain("`phoneEncrypted` TEXT NULL");
    expect(migration).toContain("`isLongTerm` BOOLEAN NOT NULL DEFAULT false");
    expect(migration).toContain("`profileIncomplete` BOOLEAN NOT NULL DEFAULT false");
    expect(migration).toContain("CREATE UNIQUE INDEX `User_nationalIdHash_key` ON `User`(`nationalIdHash`)");
    expect(migration).toContain("CREATE UNIQUE INDEX `User_phoneHash_key` ON `User`(`phoneHash`)");
    expect(migration).toContain("WHERE `role` = 'STUDENT'");
    expect(migration).toContain("WHERE `username` = 'teacher'");
    expect(migration).not.toMatch(/DROP TABLE `User`/);
  });

  it("defines dedicated student account import persistence", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260726120000_student_account_imports/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `StudentImportBatch`");
    expect(migration).toContain("CREATE TABLE `StudentImportRow`");
    expect(migration).toContain("ENUM('PREVIEW', 'COMMITTED', 'FAILED', 'EXPIRED')");
    expect(migration).toContain("`initialPasswordEncrypted` TEXT NULL");
    const hardeningMigration = fs.readFileSync(path.resolve("prisma/migrations/20260730120000_student_import_preflight_hardening/migration.sql"), "utf8");
    expect(hardeningMigration).toContain("DROP COLUMN `initialPasswordEncrypted`");
    expect(hardeningMigration).toContain("ADD COLUMN `initialPasswordHash` TEXT NULL");
    expect(migration).toContain("UNIQUE INDEX `StudentImportRow_batchId_sheetName_sourceRowNumber_key`");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).not.toMatch(/FOREIGN KEY \(`.*`\) REFERENCES `User`\(`id`\) ON DELETE CASCADE/);
  });

  it("initializes the nine compulsory education grades", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260727100000_default_grades/migration.sql"), "utf8");
    const seed = fs.readFileSync(path.resolve("prisma/seed.ts"), "utf8");

    for (const grade of ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "七年级", "八年级", "九年级"]) {
      expect(migration).toContain(grade);
      expect(seed).toContain(grade);
    }

    expect(migration).toContain("ON DUPLICATE KEY UPDATE");
    expect(seed).not.toContain('name: "高一"');
    expect(seed).not.toContain('name: "高二"');
    expect(seed).not.toContain('name: "高三"');
  });

  it("establishes the RADIO course before backfilling course-owned data", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260730120000_radio_course_boundary/migration.sql"), "utf8");
    const courseInsert = migration.indexOf("INSERT INTO `Course`");
    const firstBackfill = migration.indexOf("UPDATE `Level` SET `courseId`");

    expect(courseInsert).toBeGreaterThan(-1);
    expect(firstBackfill).toBeGreaterThan(courseInsert);
    expect(migration).not.toMatch(/DROP TABLE `(Question|PracticeSession|PracticeAnswer|WrongQuestion|ImportBatch)`/);
  });

  it("establishes and backfills the RADIO course boundary", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260730120000_radio_course_boundary/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `Course`");
    expect(migration).toContain("'course-radio', 'RADIO'");
    expect(migration).toContain("UNIQUE INDEX `Course_activeSlot_key`(`activeSlot`)");
    expect(migration).toContain("Course_enabled_active_slot_check");
    expect(migration).not.toContain("CourseBoundary");
    expect(migration).not.toContain("Course_radio_activation_check");
    for (const table of ["Level", "KnowledgePoint", "LevelPracticeRule", "KnowledgePracticeRule", "ExamRule", "Question", "ImportBatch", "PracticeSession", "PracticeSessionQuestion", "PracticeAnswer", "WrongQuestion"]) {
      expect(migration).toContain(`ALTER TABLE \`${table}\` ADD COLUMN \`courseId\``);
      expect(migration).toContain(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${table}_courseId_fkey\``);
    }
    expect(migration).toContain("CREATE UNIQUE INDEX `Question_courseId_levelId_externalQuestionCode_key`");
    expect(migration).toContain("DROP INDEX `Question_levelId_externalQuestionCode_key` ON `Question`");
    expect(migration).not.toMatch(/DELETE FROM `(Level|KnowledgePoint|Question|ImportBatch|PracticeSession)`/);
  });

  it("locks RADIO as the sole enabled course", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260730153500_enforce_radio_course_activation/migration.sql"), "utf8");

    expect(migration).toContain("DROP CHECK `Course_enabled_active_slot_check`");
    expect(migration).toContain("Course_radio_activation_check");
    expect(migration).toContain("`id` = 'course-radio'");
    expect(migration).toContain("`code` = 'RADIO'");
    expect(migration).toContain("`enabled` = true");
    expect(migration).toContain("`activeSlot` = 1");
  });

  it("initializes the radio person catalog during migration without relying on demo seed", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260730170000_radio_person_identity_registration/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `RadioPerson`");
    expect(migration).toContain("INSERT INTO `RadioPerson`");
    expect(migration).toContain("'radio-person-001', 'radio-001'");
    expect(migration).toContain("'radio-person-120', 'radio-120'");
    expect(migration).toContain("ADD COLUMN `realName`");
    expect(migration).toContain("ADD COLUMN `radioPersonId`");
  });
  it("adds versioned question revisions without discarding existing questions", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260730180000_question_revisions_and_concurrency/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `QuestionRevision`");
    expect(migration).toContain("ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1");
    expect(migration).toContain("QuestionRevision_courseId_questionId_revision_key");
    expect(migration).toContain("MIGRATION_BACKFILL");
    expect(migration).toContain("FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`");
    expect(migration).not.toMatch(/DELETE FROM `Question`|DROP TABLE `Question`/);
  });
  it("uses MySQL-native aggregate and duration SQL", () => {
    const reportsPage = fs.readFileSync(path.resolve("app/teacher/reports/page.tsx"), "utf8");
    const studentsPage = fs.readFileSync(path.resolve("app/teacher/students/page.tsx"), "utf8");
    const historyPage = fs.readFileSync(path.resolve("app/student/history/page.tsx"), "utf8");

    expect(reportsPage).toMatch(/CAST\(COUNT\(DISTINCT \\`userId\\`\) AS SIGNED\)/);
    expect(reportsPage).toContain("SUM(CASE WHEN");
    expect(studentsPage).toContain('redirect("/teacher"');
    expect(studentsPage).not.toContain("$queryRaw");
    expect(historyPage).toContain("TIMESTAMPDIFF(SECOND");
    expect(historyPage).toContain("CAST(COALESCE");
  });
});

describe("MySQL database URL protection", () => {
  it("extracts the configured database name", () => {
    expect(getDatabaseName("mysql://practice:secret@127.0.0.1:3306/practice_dev")).toBe("practice_dev");
  });

  it("rejects non-MySQL URLs and unexpected databases", () => {
    expect(() => getDatabaseName("postgresql://practice:secret@127.0.0.1:5432/practice")).toThrow("MySQL");
    expect(() => assertDatabaseName("mysql://practice:secret@127.0.0.1:3306/practice_dev", "practice_ci_integration")).toThrow("practice_ci_integration");
  });
});

describe("JSON string arrays", () => {
  it("returns a detached string array", () => {
    const source = ["A", "C"];
    const parsed = parseJsonStringArray(source, "correctOptionIds");

    expect(parsed).toEqual(["A", "C"]);
    expect(parsed).not.toBe(source);
  });

  it("rejects malformed database JSON", () => {
    expect(() => parseJsonStringArray({ answer: "A" }, "correctOptionIds")).toThrow("correctOptionIds");
    expect(() => parseJsonStringArray(["A", 2], "selectedOptionIds")).toThrow("selectedOptionIds");
  });
});
