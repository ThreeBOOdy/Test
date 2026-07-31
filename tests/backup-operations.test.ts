import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { appendRestoreDrillRecord, createRestoreDrillRecord, validateIsolatedRestoreTarget } from "@/scripts/restore-drill-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertPathInside,
  cleanupBackups,
  copyBackupOffline,
  createBackupManifest,
  decryptBackupFile,
  encryptBackupStream,
  runReportedOperation,
  selectBackupsToRetain,
  snapshotVerifiedArtifact,
  validateRestoreEvidence,
  writeBackupManifest,
  type BackupManifest,
} from "@/scripts/backup-core";

const temporaryDirectories: string[] = [];
const manifestAuthKey = Buffer.alloc(32, 7);

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "practice-backup-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function backupManifest(createdAt: string, fileName: string): BackupManifest {
  return {
    formatVersion: 1,
    databaseName: "practice",
    databaseVersion: "8.0.46",
    applicationCommit: "abc123",
    migrationVersion: "20260730153500_enforce_radio_course_activation",
    createdAt,
    encryptedFile: fileName,
    encryptedSize: 100,
    encryptedSha256: "a".repeat(64),
    encryption: {
      algorithm: "aes-256-gcm",
      keyId: "production-backup-2026",
    },
    restore: {
      composeFile: "docker-compose.prod.yml",
      databaseService: "db",
      applicationService: "app",
    },
    authentication: {
      algorithm: "hmac-sha256",
      value: "test-only",
    },
  };
}

function writeBackup(directory: string, manifest: BackupManifest, contents = "encrypted payload") {
  const encryptedFile = path.join(directory, manifest.encryptedFile);
  fs.mkdirSync(path.dirname(encryptedFile), { recursive: true });
  fs.writeFileSync(encryptedFile, contents);
  const completeManifest = createBackupManifest({
    encryptedFile,
    databaseName: manifest.databaseName,
    databaseVersion: manifest.databaseVersion,
    applicationCommit: manifest.applicationCommit,
    migrationVersion: manifest.migrationVersion,
    createdAt: new Date(manifest.createdAt),
    keyId: manifest.encryption.keyId,
    composeFile: manifest.restore.composeFile,
    databaseService: manifest.restore.databaseService,
    applicationService: manifest.restore.applicationService,
  }, manifestAuthKey);
  const manifestFile = `${encryptedFile}.manifest.json`;
  writeBackupManifest(manifestFile, completeManifest);
  return { encryptedFile, manifestFile, manifest: completeManifest };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("encrypted database backups", () => {
  it("encrypts before persistence and rejects tampered ciphertext", async () => {
    const directory = createTemporaryDirectory();
    const encryptedFile = path.join(directory, "practice.backup");
    const restoredFile = path.join(directory, "restored.sql");
    const plaintext = Buffer.from("CREATE TABLE secret(value varchar(255));\nINSERT INTO secret VALUES ('sensitive');\n");
    const key = crypto.randomBytes(32);

    const encryption = await encryptBackupStream(Readable.from(plaintext), encryptedFile, key, "test-key");

    const persisted = fs.readFileSync(encryptedFile);
    expect(persisted.includes(plaintext)).toBe(false);
    expect(encryption.algorithm).toBe("aes-256-gcm");
    await decryptBackupFile(encryptedFile, restoredFile, key);
    expect(fs.readFileSync(restoredFile)).toEqual(plaintext);

    persisted[persisted.length - 1] ^= 1;
    fs.writeFileSync(encryptedFile, persisted);
    await expect(decryptBackupFile(encryptedFile, restoredFile, key)).rejects.toThrow(/authenticate|integrity/i);
  });

  it("creates a complete recovery manifest from the encrypted artifact", () => {
    const directory = createTemporaryDirectory();
    const encryptedFile = path.join(directory, "practice-20260730.backup");
    fs.writeFileSync(encryptedFile, "encrypted payload");

    const manifest = createBackupManifest({
      encryptedFile,
      databaseName: "practice",
      databaseVersion: "8.0.46",
      applicationCommit: "c7f4298",
      migrationVersion: "20260730153500_enforce_radio_course_activation",
      createdAt: new Date("2026-07-30T08:00:00.000Z"),
      keyId: "production-backup-2026",
      composeFile: "docker-compose.prod.yml",
      databaseService: "db",
      applicationService: "app",
    }, manifestAuthKey);

    expect(manifest).toMatchObject({
      formatVersion: 1,
      databaseName: "practice",
      databaseVersion: "8.0.46",
      applicationCommit: "c7f4298",
      migrationVersion: "20260730153500_enforce_radio_course_activation",
      createdAt: "2026-07-30T08:00:00.000Z",
      encryptedFile: path.basename(encryptedFile),
      encryptedSize: 17,
      encryption: { algorithm: "aes-256-gcm", keyId: "production-backup-2026" },
      restore: {
        composeFile: "docker-compose.prod.yml",
        databaseService: "db",
        applicationService: "app",
      },
    });
    expect(manifest.encryptedSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("backup retention and operational safety", () => {
  it("retains daily, weekly, and monthly generations using manifest timestamps", () => {
    const manifests = [
      backupManifest("2026-07-30T08:00:00.000Z", "d0.backup"),
      backupManifest("2026-07-29T08:00:00.000Z", "d1.backup"),
      backupManifest("2026-07-28T08:00:00.000Z", "d2.backup"),
      backupManifest("2026-07-20T08:00:00.000Z", "w1.backup"),
      backupManifest("2026-07-13T08:00:00.000Z", "w2.backup"),
      backupManifest("2026-06-15T08:00:00.000Z", "m1.backup"),
      backupManifest("2026-05-15T08:00:00.000Z", "m2.backup"),
      backupManifest("2026-04-15T08:00:00.000Z", "expired.backup"),
    ];

    const retained = selectBackupsToRetain(manifests, {
      now: new Date("2026-07-30T12:00:00.000Z"),
      daily: 3,
      weekly: 3,
      monthly: 3,
    });

    expect([...retained].sort()).toEqual([
      "d0.backup",
      "d1.backup",
      "d2.backup",
      "m1.backup",
      "m2.backup",
      "w1.backup",
      "w2.backup",
    ]);
  });

  it("rejects deletion targets outside the configured backup root", () => {
    const directory = createTemporaryDirectory();
    expect(assertPathInside(directory, path.join(directory, "practice.backup"))).toBe(path.join(directory, "practice.backup"));
    expect(() => assertPathInside(directory, path.join(directory, "..", "outside.backup"))).toThrow(/outside/i);
  });

  it("rejects paths that escape through a directory link", () => {
    const directory = createTemporaryDirectory();
    const outsideDirectory = createTemporaryDirectory();
    const link = path.join(directory, "linked");
    fs.symlinkSync(outsideDirectory, link, process.platform === "win32" ? "junction" : "dir");

    expect(() => assertPathInside(directory, path.join(link, "escape.backup"))).toThrow(/outside|symbolic links/i);
  });

  it("deletes only expired artifacts selected from manifest creation times", () => {
    const directory = createTemporaryDirectory();
    const current = writeBackup(directory, backupManifest("2026-07-30T08:00:00.000Z", "current.backup"));
    const expired = writeBackup(directory, backupManifest("2026-07-29T08:00:00.000Z", "expired.backup"));

    const result = cleanupBackups(directory, {
      now: new Date("2026-07-30T12:00:00.000Z"),
      daily: 1,
      weekly: 0,
      monthly: 0,
    }, manifestAuthKey);

    expect(result.removed).toEqual(["expired.backup"]);
    expect(fs.existsSync(current.encryptedFile)).toBe(true);
    expect(fs.existsSync(current.manifestFile)).toBe(true);
    expect(fs.existsSync(expired.encryptedFile)).toBe(false);
    expect(fs.existsSync(expired.manifestFile)).toBe(false);
  });

  it("cleans mixed encryption-key generations with one stable manifest key", () => {
    const directory = createTemporaryDirectory();
    const currentManifest = backupManifest("2026-07-30T08:00:00.000Z", "current.backup");
    currentManifest.encryption.keyId = "backup-key-2026-b";
    const expiredManifest = backupManifest("2026-07-29T08:00:00.000Z", "expired.backup");
    expiredManifest.encryption.keyId = "backup-key-2026-a";
    const current = writeBackup(directory, currentManifest);
    const expired = writeBackup(directory, expiredManifest);

    const result = cleanupBackups(
      directory,
      { now: new Date("2026-07-30T12:00:00.000Z"), daily: 1, weekly: 0, monthly: 0 },
      manifestAuthKey,
    );

    expect(result.removed).toEqual(["expired.backup"]);
    expect(fs.existsSync(current.encryptedFile)).toBe(true);
    expect(fs.existsSync(expired.encryptedFile)).toBe(false);
  });

  it("refuses cleanup when a manifest creation time is in the future", () => {
    const directory = createTemporaryDirectory();
    const future = writeBackup(directory, backupManifest("2026-07-31T08:00:00.000Z", "future.backup"));

    expect(() =>
      cleanupBackups(directory, {
        now: new Date("2026-07-30T12:00:00.000Z"),
        daily: 1,
        weekly: 1,
        monthly: 1,
      }, manifestAuthKey),
    ).toThrow(/future/i);
    expect(fs.existsSync(future.encryptedFile)).toBe(true);
    expect(fs.existsSync(future.manifestFile)).toBe(true);
  });

  it("copies encrypted backups offline and verifies the copied hash", () => {
    const directory = createTemporaryDirectory();
    const offlineDirectory = createTemporaryDirectory();
    const encryptedFile = path.join(directory, "practice.backup");
    const manifestFile = `${encryptedFile}.manifest.json`;
    fs.writeFileSync(encryptedFile, "encrypted payload");
    const manifest = createBackupManifest({
      encryptedFile,
      databaseName: "practice",
      databaseVersion: "8.0.46",
      applicationCommit: "c7f4298",
      migrationVersion: "20260730153500_enforce_radio_course_activation",
      createdAt: new Date("2026-07-30T08:00:00.000Z"),
      keyId: "production-backup-2026",
      composeFile: "docker-compose.prod.yml",
      databaseService: "db",
      applicationService: "app",
    }, manifestAuthKey);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));

    const copied = copyBackupOffline(manifestFile, directory, offlineDirectory, manifestAuthKey);

    expect(fs.readFileSync(copied.encryptedFile)).toEqual(fs.readFileSync(encryptedFile));
    expect(JSON.parse(fs.readFileSync(copied.manifestFile, "utf8"))).toEqual(manifest);
    expect(copied.sha256).toBe(manifest.encryptedSha256);
  });

  it("rejects an offline copy when the source no longer matches its manifest", () => {
    const directory = createTemporaryDirectory();
    const offlineDirectory = createTemporaryDirectory();
    const backup = writeBackup(directory, backupManifest("2026-07-30T08:00:00.000Z", "practice.backup"));
    fs.appendFileSync(backup.encryptedFile, "tampered");

    expect(() => copyBackupOffline(backup.manifestFile, directory, offlineDirectory, manifestAuthKey)).toThrow(/checksum mismatch/i);
    expect(fs.readdirSync(offlineDirectory)).toEqual([]);
  });

  it("refuses to overwrite an existing offline generation", () => {
    const directory = createTemporaryDirectory();
    const offlineDirectory = createTemporaryDirectory();
    const backup = writeBackup(directory, backupManifest("2026-07-30T08:00:00.000Z", "practice.backup"));
    const firstCopy = copyBackupOffline(backup.manifestFile, directory, offlineDirectory, manifestAuthKey);

    expect(() => copyBackupOffline(backup.manifestFile, directory, offlineDirectory, manifestAuthKey)).toThrow(/already exists/i);
    expect(fs.readFileSync(firstCopy.encryptedFile)).toEqual(fs.readFileSync(backup.encryptedFile));
  });

  it("creates an immutable encrypted snapshot only when its hash matches", () => {
    const directory = createTemporaryDirectory();
    const backup = writeBackup(directory, backupManifest("2026-07-30T08:00:00.000Z", "practice.backup"));

    const snapshot = snapshotVerifiedArtifact(backup.encryptedFile, backup.manifest.encryptedSha256);

    expect(snapshot).not.toBe(backup.encryptedFile);
    expect(fs.readFileSync(snapshot)).toEqual(fs.readFileSync(backup.encryptedFile));
    fs.rmSync(snapshot);
    expect(() => snapshotVerifiedArtifact(backup.encryptedFile, "0".repeat(64))).toThrow(/snapshot checksum mismatch/i);
  });

  it("rejects a manifest whose recovery metadata was modified without the key", () => {
    const directory = createTemporaryDirectory();
    const backup = writeBackup(directory, backupManifest("2026-07-30T08:00:00.000Z", "practice.backup"));
    const tampered = JSON.parse(fs.readFileSync(backup.manifestFile, "utf8")) as BackupManifest;
    tampered.databaseName = "attacker_database";
    fs.writeFileSync(backup.manifestFile, JSON.stringify(tampered));

    expect(() => copyBackupOffline(backup.manifestFile, directory, createTemporaryDirectory(), manifestAuthKey)).toThrow(
      /manifest authentication failed/i,
    );
  });

  it.skipIf(process.platform === "win32")("rejects cleanup when an expired artifact is a link to a retained backup", () => {
    const directory = createTemporaryDirectory();
    const current = writeBackup(directory, backupManifest("2026-07-30T08:00:00.000Z", "current.backup"));
    const expired = writeBackup(directory, backupManifest("2026-07-29T08:00:00.000Z", "expired.backup"));
    fs.unlinkSync(expired.encryptedFile);
    fs.symlinkSync(current.encryptedFile, expired.encryptedFile, "file");

    expect(() =>
      cleanupBackups(
        directory,
        { now: new Date("2026-07-30T12:00:00.000Z"), daily: 1, weekly: 0, monthly: 0 },
        manifestAuthKey,
      ),
    ).toThrow(/symbolic links/i);
    expect(fs.existsSync(current.encryptedFile)).toBe(true);
  });

  it("persists alert-compatible failure logs and returns a nonzero result", async () => {
    const directory = createTemporaryDirectory();
    const logFile = path.join(directory, "operations.jsonl");
    const messages: string[] = [];

    const exitCode = await runReportedOperation(
      "backup",
      logFile,
      async () => {
        throw new Error("mysqldump failed");
      },
      (message) => messages.push(message),
    );

    expect(exitCode).toBe(1);
    const record = JSON.parse(fs.readFileSync(logFile, "utf8").trim()) as Record<string, unknown>;
    expect(record).toMatchObject({ level: "error", status: "failed", action: "backup", message: "mysqldump failed" });
    expect(messages.join("\n")).toContain('"status":"failed"');
  });

  it("returns a nonzero CLI exit and persists its failure record", () => {
    const directory = createTemporaryDirectory();
    const logFile = path.join(directory, "operations.jsonl");
    const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const backupCli = path.join(process.cwd(), "scripts", "backup-cli.ts");

    const result = spawnSync(
      process.execPath,
      [tsxCli, backupCli, "verify", "--manifest", path.join(directory, "missing.manifest.json"), "--backup-root", directory, "--log-file", logFile],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    const record = JSON.parse(fs.readFileSync(logFile, "utf8").trim()) as Record<string, unknown>;
    expect(record).toMatchObject({ level: "error", status: "failed", action: "verify" });
    expect(result.stdout).toContain('"status":"failed"');
  });
});

describe("restore validation", () => {
  it("accepts matching migration, core counts, login data, and RADIO course evidence", () => {
    const manifest = backupManifest("2026-07-30T08:00:00.000Z", "practice.backup");
    expect(
      validateRestoreEvidence(manifest, {
        migrationVersion: manifest.migrationVersion,
        tableCounts: { User: 3, Course: 1, Question: 20, PracticeSession: 4 },
        activeLoginAccounts: 3,
        enabledRadioCourses: 1,
        sensitiveFields: "verified",
      }),
    ).toMatchObject({ enabledRadioCourses: 1, sensitiveFields: "verified" });
  });

  it("rejects a restore whose migration or core data does not match", () => {
    const manifest = backupManifest("2026-07-30T08:00:00.000Z", "practice.backup");
    expect(() =>
      validateRestoreEvidence(manifest, {
        migrationVersion: "wrong-migration",
        tableCounts: { User: 0, Course: 0, Question: 0, PracticeSession: 0 },
        activeLoginAccounts: 0,
        enabledRadioCourses: 0,
        sensitiveFields: "not-present",
      }),
    ).toThrow(/migration version mismatch/i);
  });

  it("rejects matching migrations when restored question data is empty", () => {
    const manifest = backupManifest("2026-07-30T08:00:00.000Z", "practice.backup");
    expect(() =>
      validateRestoreEvidence(manifest, {
        migrationVersion: manifest.migrationVersion,
        tableCounts: { User: 2, Course: 1, Question: 0, PracticeSession: 0 },
        activeLoginAccounts: 2,
        enabledRadioCourses: 1,
        sensitiveFields: "not-present",
      }),
    ).toThrow(/no practice questions/i);
  });
});

describe("isolated restore drills", () => {
  it("requires an explicitly isolated target and records a successful drill", () => {
    const directory = createTemporaryDirectory();
    const isolationRoot = path.join(directory, "isolated-restore");
    const composeFile = path.join(isolationRoot, "docker-compose.restore.yml");
    fs.mkdirSync(isolationRoot, { recursive: true });
    fs.writeFileSync(composeFile, "services: {}\n");

    const target = validateIsolatedRestoreTarget({
      isolationConfirmed: "true",
      environment: "isolated",
      targetId: "monthly-drill-01",
      isolationRoot,
      composeFile,
      databaseName: "practice_restore_drill",
      composeProject: "practice-restore-drill",
    });
    const record = createRestoreDrillRecord({
      backupId: "practice-20260731T000000Z.backup.manifest.json",
      startedAt: new Date("2026-07-31T00:00:00.000Z"),
      completedAt: new Date("2026-07-31T00:00:03.000Z"),
      target,
      checks: { migrationVersion: "20260730153500_enforce_radio_course_activation" },
    });
    const recordFile = path.join(directory, "logs", "restore-drills.jsonl");
    appendRestoreDrillRecord(recordFile, record);

    expect(record).toMatchObject({ status: "succeeded", durationMs: 3000, findings: [], target: { environment: "isolated" } });
    expect(JSON.parse(fs.readFileSync(recordFile, "utf8"))).toMatchObject({ backupId: record.backupId, status: "succeeded" });
  });

  it("persists a failure reason and finding when a drill fails", () => {
    const target = {
      id: "monthly-drill-01",
      environment: "isolated" as const,
      databaseName: "practice_restore_drill",
      composeProject: "practice-restore-drill",
    };
    const record = createRestoreDrillRecord({
      backupId: "practice-20260731T000000Z.backup.manifest.json",
      startedAt: new Date("2026-07-31T00:00:00.000Z"),
      completedAt: new Date("2026-07-31T00:00:01.000Z"),
      target,
      error: new Error("application readiness failed"),
    });

    expect(record).toMatchObject({
      status: "failed",
      durationMs: 1000,
      failureReason: "application readiness failed",
      findings: ["application readiness failed"],
    });
  });
  it("imports restored data into the validated isolated database and starts the complete stack", () => {
    const cli = fs.readFileSync(path.join(process.cwd(), "scripts", "backup-cli.ts"), "utf8");

    expect(cli).toContain('shellQuote(databaseName(options))} < ${shellQuote(temporaryRestoreFile)}');
    expect(cli).toContain('dockerComposeArgs(options, "up", "-d")');
    expect(cli).not.toContain('shellQuote(verified.manifest.databaseName)} < ${shellQuote(temporaryRestoreFile)}');
  });
  it("keeps the legacy restore wrapper on the isolated restore-drill command", () => {
    const wrapper = fs.readFileSync(path.join(process.cwd(), "scripts", "restore.ps1"), "utf8");

    expect(wrapper).toContain("restore-drill");
    expect(wrapper).toContain("--isolation-root");
    expect(wrapper).toContain("BACKUP_RESTORE_ISOLATED");
  });
  it("rejects a restore drill that could target a non-isolated database", () => {
    const directory = createTemporaryDirectory();
    const isolationRoot = path.join(directory, "isolated-restore");
    const composeFile = path.join(isolationRoot, "docker-compose.restore.yml");
    fs.mkdirSync(isolationRoot, { recursive: true });
    fs.writeFileSync(composeFile, "services: {}\n");

    expect(() => validateIsolatedRestoreTarget({
      isolationConfirmed: "true",
      environment: "isolated",
      targetId: "monthly-drill-01",
      isolationRoot,
      composeFile,
      databaseName: "practice",
      composeProject: "practice-restore-drill",
    })).toThrow(/database name must identify an isolated restore target/i);
  });
});
