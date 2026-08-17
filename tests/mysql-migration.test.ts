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

  it("prevents deleting questions that have retained revisions", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260731110000_archive_only_question_lifecycle/migration.sql"), "utf8");

    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).not.toMatch(/DELETE FROM `Question`|DROP TABLE `Question`/);
  });
  it("creates the question-level image table with binary content and immutable storage", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260805000000_question_images/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `QuestionImage`");
    expect(migration).toContain("`data` LONGBLOB NOT NULL");
    expect(migration).toContain("`mimeType` VARCHAR(64) NOT NULL");
    expect(migration).toContain("`sizeBytes` INTEGER NOT NULL");
    expect(migration).toContain("`contentHash` VARCHAR(64) NOT NULL");
    expect(migration).toContain("`field` VARCHAR(32) NOT NULL");
    expect(migration).toContain("`sortOrder` INTEGER NOT NULL");
    expect(migration).toContain("FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE");
    expect(migration).not.toMatch(/DROP TABLE `Question`|DELETE FROM `Question`/);
  });
  it("creates the preview-time batch image table that cascades with the import batch", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260805030000_import_batch_images/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `ImportBatchImage`");
    expect(migration).toContain("`id` VARCHAR(191) NOT NULL");
    expect(migration).toContain("`rowNumber` INTEGER NOT NULL");
    expect(migration).toContain("`data` LONGBLOB NOT NULL");
    expect(migration).toContain("`mimeType` VARCHAR(64) NOT NULL");
    expect(migration).toContain("`sizeBytes` INTEGER NOT NULL");
    expect(migration).toContain("`contentHash` VARCHAR(64) NOT NULL");
    expect(migration).toContain("UNIQUE INDEX `ImportBatchImage_batchId_id_key`(`batchId`, `id`)");
    expect(migration).toContain("FOREIGN KEY (`batchId`) REFERENCES `ImportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
    expect(migration).toContain("utf8mb4_0900_ai_ci");
  });
  it("uses MySQL-native aggregate and duration SQL", () => {
    const statisticsService = fs.readFileSync(path.resolve("lib/server/learning-statistics-service.ts"), "utf8");
    const studentsPage = fs.readFileSync(path.resolve("app/teacher/students/page.tsx"), "utf8");

    expect(statisticsService).toMatch(/CAST\(COUNT\(DISTINCT/);
    expect(statisticsService).toContain("SUM(CASE WHEN");
    expect(studentsPage).toContain('redirect("/teacher"');
    expect(studentsPage).not.toContain("$queryRaw");
    expect(statisticsService).toContain("TIMESTAMPDIFF(SECOND");
    expect(statisticsService).toContain("CAST(COALESCE");
  });
  it("adds AI explanation fields and the AI usage log without discarding questions", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260817000000_ai_gateway_and_usage_log/migration.sql"), "utf8");
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

    expect(migration).toContain("ALTER TABLE `Question` ADD COLUMN `explanation` TEXT NULL");
    expect(migration).toContain("ADD COLUMN `explanationStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE'");
    expect(migration).toContain("ADD COLUMN `explanationVersion` INTEGER NOT NULL DEFAULT 0");
    expect(migration).toContain("ADD COLUMN `explanationReviewedById` VARCHAR(191) NULL");
    expect(migration).toContain("ADD COLUMN `explanationReviewedAt` DATETIME(3) NULL");
    expect(migration).toContain("CREATE TABLE `AiUsageLog`");
    expect(migration).toContain("`promptTokens` INTEGER NOT NULL DEFAULT 0");
    expect(migration).toContain("`completionTokens` INTEGER NOT NULL DEFAULT 0");
    expect(migration).toContain("`totalTokens` INTEGER NOT NULL DEFAULT 0");
    expect(migration).toContain("`latencyMs` INTEGER NULL");
    expect(migration).toContain("`requestHash` VARCHAR(191) NULL");
    expect(migration).toContain("FOREIGN KEY (`explanationReviewedById`) REFERENCES `User`(`id`)");
    expect(migration).toContain("FOREIGN KEY (`userId`) REFERENCES `User`(`id`)");
    expect(migration).not.toMatch(/DROP TABLE `(Question|User)`|DELETE FROM `Question`/);

    expect(schema).toMatch(/explanationStatus\s+String\s+@default\("NONE"\)/);
    expect(schema).toContain("model AiUsageLog {");
  });
  it("adds the AI explanation rejection reason field without discarding questions", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260817010000_ai_explanation_review_reject_reason/migration.sql"), "utf8");
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

    expect(migration).toContain("ALTER TABLE `Question` ADD COLUMN `explanationRejectReason` TEXT NULL");
    expect(schema).toContain("explanationRejectReason String?");
    expect(schema).toContain("@db.Text");
    expect(migration).not.toMatch(/DROP TABLE `Question`|DELETE FROM `Question`/);
  });
  it("creates AI tutor conversation and message tables without discarding questions", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260817020000_ai_tutor_conversation/migration.sql"), "utf8");
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

    expect(migration).toContain("CREATE TABLE `AiConversation`");
    expect(migration).toContain("CREATE TABLE `AiMessage`");
    expect(migration).toContain("`practiceSessionId` VARCHAR(191) NULL");
    expect(migration).toContain("`role` VARCHAR(191) NOT NULL");
    expect(migration).toContain("`content` TEXT NOT NULL");
    expect(migration).toContain("`feedback` VARCHAR(191) NULL");
    expect(migration).toContain("FOREIGN KEY (`userId`) REFERENCES `User`(`id`)");
    expect(migration).toContain("FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`)");
    expect(migration).toContain("FOREIGN KEY (`practiceSessionId`) REFERENCES `PracticeSession`(`id`)");
    expect(migration).toContain("FOREIGN KEY (`conversationId`) REFERENCES `AiConversation`(`id`)");
    expect(migration).not.toMatch(/DROP TABLE `Question`|DELETE FROM `Question`/);

    expect(schema).toContain("model AiConversation {");
    expect(schema).toContain("model AiMessage {");
    expect(schema).toMatch(/practiceSession\s+PracticeSession\?/);
    expect(schema).toMatch(/aiConversations\s+AiConversation\[\]/);
  });
  it("creates focus session tables without discarding questions", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260817030000_focus_session_and_streak/migration.sql"), "utf8");
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

    expect(migration).toContain("CREATE TABLE `FocusSession`");
    expect(migration).toContain("ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS'");
    expect(migration).toContain("`targetMinutes` INTEGER NULL");
    expect(migration).toContain("`targetQuestionCount` INTEGER NULL");
    expect(migration).toContain("`actualMinutes` INTEGER NULL");
    expect(migration).toContain("`actualQuestionCount` INTEGER NULL");
    expect(migration).toContain("`endedAt` DATETIME(3) NULL");
    expect(migration).toContain("FOREIGN KEY (`userId`) REFERENCES `User`(`id`)");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).toContain("FocusSession_userId_status_startedAt_idx");
    expect(migration).not.toMatch(/DROP TABLE `Question`|DELETE FROM `Question`/);

    expect(schema).toContain("model FocusSession {");
    expect(schema).toContain("enum FocusSessionStatus {");
    expect(schema).toMatch(/focusSessions\s+FocusSession\[\]/);
  });
  it("adds review plan and review card tables without discarding existing data", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260818000000_review_plan_and_cards/migration.sql"), "utf8");
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

    expect(migration).toContain("CREATE TABLE `ReviewPlan`");
    expect(migration).toContain("CREATE TABLE `ReviewCard`");
    expect(migration).toContain("`planDate` DATE NOT NULL");
    expect(migration).toContain("ENUM('DAILY', 'EXAM_SPRINT')");
    expect(migration).toContain("ENUM('WRONG_QUESTION', 'WEAK_KNOWLEDGE')");
    expect(migration).toContain("FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE");
    expect(migration).toContain("FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT");
    expect(migration).not.toMatch(/DROP TABLE `(Question|User|ReviewPlan|ReviewCard)`|DELETE FROM `Question`/);

    expect(schema).toContain("model ReviewPlan {");
    expect(schema).toContain("model ReviewCard {");
    expect(schema).toMatch(/reviewPlans\s+ReviewPlan\[\]/);
    expect(schema).toMatch(/reviewCards\s+ReviewCard\[\]/);
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
