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
    expect(migration).toContain("UNIQUE INDEX `StudentImportRow_batchId_sheetName_sourceRowNumber_key`");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).not.toMatch(/FOREIGN KEY \(`.*`\) REFERENCES `User`\(`id`\) ON DELETE CASCADE/);
  });

  it("uses MySQL-native aggregate and duration SQL", () => {
    const reportsPage = fs.readFileSync(path.resolve("app/teacher/reports/page.tsx"), "utf8");
    const studentsPage = fs.readFileSync(path.resolve("app/teacher/students/page.tsx"), "utf8");
    const historyPage = fs.readFileSync(path.resolve("app/student/history/page.tsx"), "utf8");

    expect(reportsPage).toMatch(/CAST\(COUNT\(DISTINCT \\`userId\\`\) AS SIGNED\)/);
    expect(reportsPage).toContain("SUM(CASE WHEN");
    expect(studentsPage).toContain('redirect("/admin/students"');
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
