import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  cleanupBackups,
  copyBackupOffline,
  createBackupManifest,
  decryptBackupToWritable,
  encryptBackupStream,
  runReportedOperation,
  snapshotVerifiedArtifact,
  verifyEncryptedBackup,
  verifyManifestArtifact,
  validateRestoreEvidence,
  writeBackupManifest,
} from "./backup-core";
import { appendRestoreDrillRecord, createRestoreDrillRecord, validateIsolatedRestoreTarget } from "./restore-drill-core";

type Options = Record<string, string | boolean>;

const projectRoot = path.resolve(__dirname, "..");

function parseArguments(values: string[]) {
  const [rawCommand, ...args] = values;
  const command = rawCommand || undefined;
  const options: Options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const key = argument.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

function option(options: Options, key: string, fallback?: string) {
  const value = options[key];
  if (typeof value === "string") {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required option --${key}`);
}

function integerOption(options: Options, key: string, fallback: number) {
  const value = Number(option(options, key, String(fallback)));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${key} must be a non-negative integer`);
  }
  return value;
}

function resolveFromProject(value: string) {
  return path.resolve(projectRoot, value);
}

function backupRoot(options: Options) {
  return resolveFromProject(option(options, "backup-root", process.env.BACKUP_DIRECTORY ?? "backups"));
}

function logFile(options: Options) {
  return resolveFromProject(option(options, "log-file", process.env.BACKUP_LOG_FILE ?? "logs/backup-operations.jsonl"));
}

function drillLogFile(options: Options) {
  return resolveFromProject(option(options, "drill-log-file", process.env.BACKUP_RESTORE_DRILL_LOG_FILE ?? "logs/restore-drills.jsonl"));
}

function composeFile(options: Options) {
  return option(options, "compose-file", process.env.BACKUP_COMPOSE_FILE ?? "docker-compose.prod.yml");
}

function databaseService(options: Options) {
  return option(options, "database-service", process.env.BACKUP_DATABASE_SERVICE ?? "db");
}

function applicationService(options: Options) {
  return option(options, "application-service", process.env.BACKUP_APPLICATION_SERVICE ?? "app");
}

function databaseName(options: Options) {
  return option(options, "database-name", process.env.BACKUP_DATABASE_NAME ?? "practice");
}

function secretKey(name: "BACKUP_ENCRYPTION_KEY" | "BACKUP_MANIFEST_AUTH_KEY") {
  const encoded = process.env[name];
  if (!encoded) {
    throw new Error(`${name} is required and must be a Base64-encoded 32-byte key`);
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.trim().replace(/=+$/, "")) {
    throw new Error(`${name} must be a valid Base64-encoded 32-byte key`);
  }
  return key;
}

function encryptionKey() {
  return secretKey("BACKUP_ENCRYPTION_KEY");
}

function manifestAuthKey() {
  return secretKey("BACKUP_MANIFEST_AUTH_KEY");
}

function encryptionKeyId() {
  const keyId = process.env.BACKUP_ENCRYPTION_KEY_ID?.trim();
  if (!keyId) {
    throw new Error("BACKUP_ENCRYPTION_KEY_ID is required");
  }
  return keyId;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function runCommand(command: string, args: string[], input?: PassThrough) {
  const child = spawn(command, args, { cwd: projectRoot, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
  const stdoutStream = child.stdout;
  const stderrStream = child.stderr;
  if (!stdoutStream || !stderrStream) {
    child.kill();
    throw new Error(`Failed to capture output from ${command}`);
  }
  const processResult = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    stdoutStream.on("data", (chunk: Buffer) => stdout.push(chunk));
    stderrStream.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();
      if (code === 0) {
        resolve({ stdout: stdoutText, stderr: stderrText });
      } else {
        reject(new Error(`${command} exited with code ${code}${stderrText ? `: ${stderrText.slice(-8192)}` : ""}`));
      }
    });
  });
  const inputResult = input && child.stdin ? pipeline(input, child.stdin) : Promise.resolve();
  try {
    const [result] = await Promise.all([processResult, inputResult]);
    return result;
  } catch (error) {
    child.kill();
    input?.destroy(error instanceof Error ? error : new Error(`Failed to pipe input to ${command}`));
    await Promise.allSettled([processResult, inputResult]);
    throw error;
  }
}

function dockerComposeArgs(options: Options, ...args: string[]) {
  const project = typeof options["compose-project"] === "string" ? options["compose-project"] : process.env.BACKUP_RESTORE_COMPOSE_PROJECT;
  return ["compose", "-f", composeFile(options), ...(project ? ["--project-name", project] : []), ...args];
}

async function queryDatabase(options: Options, sql: string) {
  const command = `exec mysql -u practice -p"$MYSQL_PASSWORD" --batch --skip-column-names ${shellQuote(databaseName(options))} -e ${shellQuote(sql)}`;
  const result = await runCommand("docker", dockerComposeArgs(options, "exec", "-T", databaseService(options), "sh", "-c", command));
  return result.stdout;
}

async function applicationCommit() {
  if (process.env.APP_COMMIT?.trim()) {
    return process.env.APP_COMMIT.trim();
  }
  return (await runCommand("git", ["rev-parse", "HEAD"])).stdout;
}

function fileTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function createEncryptedBackup(options: Options) {
  const root = backupRoot(options);
  fs.mkdirSync(root, { recursive: true });
  const createdAt = new Date();
  const encryptedFile = path.join(root, `practice-${fileTimestamp(createdAt)}.backup`);
  const manifestFile = `${encryptedFile}.manifest.json`;
  const key = encryptionKey();
  const manifestKey = manifestAuthKey();
  const keyId = encryptionKeyId();
  const databaseVersion = await queryDatabase(options, "SELECT VERSION()");
  const migrationVersion = await queryDatabase(
    options,
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1",
  );
  if (!databaseVersion || !migrationVersion) {
    throw new Error("Database version or migration version could not be determined");
  }
  const commit = await applicationCommit();
  const dumpCommand = `exec mysqldump -u practice -p"$MYSQL_PASSWORD" --single-transaction --routines --triggers --set-gtid-purged=OFF ${shellQuote(databaseName(options))}`;
  const dump = spawn(
    "docker",
    dockerComposeArgs(options, "exec", "-T", databaseService(options), "sh", "-c", dumpCommand),
    { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  const stderr: Buffer[] = [];
  dump.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  const dumpResult = new Promise<void>((resolve, reject) => {
    dump.once("error", reject);
    dump.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const detail = Buffer.concat(stderr).toString("utf8").trim().slice(-8192);
        reject(new Error(`mysqldump exited with code ${code}${detail ? `: ${detail}` : ""}`));
      }
    });
  });

  const encryptionResult = encryptBackupStream(dump.stdout, encryptedFile, key, keyId);
  try {
    await Promise.all([encryptionResult, dumpResult]);
    await verifyEncryptedBackup(encryptedFile, key);
    const manifest = createBackupManifest({
      encryptedFile,
      databaseName: databaseName(options),
      databaseVersion,
      applicationCommit: commit,
      migrationVersion,
      createdAt,
      keyId,
      composeFile: composeFile(options),
      databaseService: databaseService(options),
      applicationService: applicationService(options),
    }, manifestKey);
    writeBackupManifest(manifestFile, manifest);
    return { encryptedFile, manifestFile, sha256: manifest.encryptedSha256 };
  } catch (error) {
    dump.kill();
    await Promise.allSettled([encryptionResult, dumpResult]);
    fs.rmSync(encryptedFile, { force: true });
    fs.rmSync(manifestFile, { force: true });
    throw error;
  } finally {
    manifestKey.fill(0);
    key.fill(0);
  }
}

function retentionPolicy(options: Options) {
  return {
    now: new Date(),
    daily: integerOption(options, "daily", Number(process.env.BACKUP_RETENTION_DAILY ?? 14)),
    weekly: integerOption(options, "weekly", Number(process.env.BACKUP_RETENTION_WEEKLY ?? 8)),
    monthly: integerOption(options, "monthly", Number(process.env.BACKUP_RETENTION_MONTHLY ?? 12)),
  };
}

async function runBackup(options: Options) {
  const backup = await createEncryptedBackup(options);
  const manifestKey = manifestAuthKey();
  try {
    const retention = cleanupBackups(backupRoot(options), retentionPolicy(options), manifestKey);
    const offlineRootValue = typeof options["offline-root"] === "string" ? options["offline-root"] : process.env.BACKUP_OFFLINE_DIRECTORY;
    const offline = offlineRootValue
      ? copyBackupOffline(backup.manifestFile, backupRoot(options), resolveFromProject(offlineRootValue), manifestKey)
      : undefined;
    return { backup, retention, offline };
  } finally {
    manifestKey.fill(0);
  }
}

function parseCount(value: string, label: string) {
  const count = Number(value.trim());
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid ${label} count returned by restored database`);
  }
  return count;
}

function sensitiveDataKeyring() {
  const currentKeyId = process.env.STUDENT_DATA_ENCRYPTION_KEY_ID?.trim() || "default";
  const currentKey = process.env.STUDENT_DATA_ENCRYPTION_KEY;
  if (!currentKey) throw new Error("STUDENT_DATA_ENCRYPTION_KEY is required to validate restored sensitive fields");
  const decodeKey = (value: string, label: string) => {
    const key = Buffer.from(value, "base64");
    if (key.length !== 32 || key.toString("base64") !== value) throw new Error(`${label} must be a Base64-encoded 32-byte key`);
    return key;
  };
  const keys = new Map([[currentKeyId, decodeKey(currentKey, "STUDENT_DATA_ENCRYPTION_KEY")]]);
  const additional = process.env.STUDENT_DATA_DECRYPTION_KEYS?.trim();
  if (!additional) return keys;
  let parsed: unknown;
  try {
    parsed = JSON.parse(additional);
  } catch {
    throw new Error("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
  }
  for (const [keyId, encoded] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(keyId) || typeof encoded !== "string") {
      throw new Error("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
    }
    keys.set(keyId, decodeKey(encoded, "STUDENT_DATA_DECRYPTION_KEYS"));
  }
  return keys;
}

function decryptStudentSensitiveSample(value: string, keys: Map<string, Buffer>) {
  const parts = value.split(".");
  const [version, keyId, encodedPayload] = parts;
  const isLegacy = version === "v1" && parts.length === 2;
  const isVersionTwo = version === "v2" && Boolean(keyId) && Boolean(encodedPayload) && parts.length === 3;
  if (!isLegacy && !isVersionTwo) throw new Error("Unsupported restored sensitive value format");
  const payloadValue = isLegacy ? keyId : encodedPayload;
  if (!payloadValue) throw new Error("Unsupported restored sensitive value format");
  const payload = Buffer.from(payloadValue, "base64url");
  if (payload.length < 28) throw new Error("Restored sensitive value authentication failed");
  const iv = payload.subarray(0, 12);
  const ciphertext = payload.subarray(12, -16);
  const authTag = payload.subarray(-16);
  const candidateKeys = isLegacy ? [...keys.values()] : [keys.get(keyId!)].filter((key): key is Buffer => Boolean(key));
  for (const key of candidateKeys) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
      decipher.setAAD(Buffer.from(isLegacy ? "v1" : `v2.${keyId}`));
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      if (plaintext.length > 0) return isLegacy ? "legacy" : keyId!;
    } catch {}
  }
  throw new Error("Restored sensitive value authentication failed");
}
async function validateRestoredDatabase(options: Options, manifest: ReturnType<typeof verifyManifestArtifact>["manifest"]) {
  const migrationVersion = await queryDatabase(
    options,
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1",
  );
  const countRows = await queryDatabase(
    options,
    "SELECT 'User', COUNT(*) FROM `User` UNION ALL SELECT 'Course', COUNT(*) FROM `Course` UNION ALL SELECT 'Question', COUNT(*) FROM `Question` UNION ALL SELECT 'PracticeSession', COUNT(*) FROM `PracticeSession`",
  );
  const tableCounts = Object.fromEntries(
    countRows.split(/\r?\n/).map((row) => {
      const [table, count] = row.split("\t");
      if (!table || count === undefined) {
        throw new Error("Restored table count query returned an invalid row");
      }
      return [table, parseCount(count, table)];
    }),
  );
  const activeLoginAccounts = parseCount(
    await queryDatabase(options, "SELECT COUNT(*) FROM `User` WHERE enabled = 1 AND passwordHash <> ''"),
    "active login account",
  );
  const enabledRadioCourses = parseCount(
    await queryDatabase(options, "SELECT COUNT(*) FROM `Course` WHERE code = 'RADIO' AND enabled = 1"),
    "enabled RADIO course",
  );
  const sensitiveRow = await queryDatabase(
    options,
    "SELECT COALESCE(nationalIdEncrypted, ''), COALESCE(phoneEncrypted, '') FROM `User` WHERE nationalIdEncrypted IS NOT NULL OR phoneEncrypted IS NOT NULL LIMIT 1",
  );
  let sensitiveFields: "verified" | "not-present" = "not-present";
  let sensitiveFieldKeyIds: string[] | undefined;
  if (sensitiveRow) {
    const keys = sensitiveDataKeyring();
    try {
      sensitiveFieldKeyIds = [...new Set(sensitiveRow.split("\t").filter(Boolean).map((value) => decryptStudentSensitiveSample(value, keys)))];
      sensitiveFields = "verified";
    } finally {
      for (const key of keys.values()) key.fill(0);
    }
  }
  return validateRestoreEvidence(manifest, {
    migrationVersion,
    tableCounts,
    activeLoginAccounts,
    enabledRadioCourses,
    sensitiveFields,
    ...(sensitiveFieldKeyIds ? { sensitiveFieldKeyIds } : {}),
  });
}

async function smokeFetch(url: URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForRestoredAppReady(url: URL) {
  const deadline = Date.now() + 90_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await smokeFetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Restored application readiness check returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw lastError instanceof Error ? lastError : new Error("Restored application did not become ready in time");
}

async function verifyRestoredApplication(options: Options) {
  const baseUrlValue = option(options, "base-url", process.env.BACKUP_RESTORE_BASE_URL);
  const username = option(options, "smoke-username", process.env.BACKUP_RESTORE_SMOKE_USERNAME);
  const password = option(options, "smoke-password", process.env.BACKUP_RESTORE_SMOKE_PASSWORD);
  const levelCode = option(options, "smoke-level", process.env.BACKUP_RESTORE_SMOKE_LEVEL_CODE ?? "A");
  const baseUrl = new URL(baseUrlValue);
  const origin = baseUrl.origin;

  await waitForRestoredAppReady(new URL("/api/health/ready", baseUrl));

  const login = await smokeFetch(new URL("/api/v1/auth/login", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ username, password }),
  });
  if (!login.ok) {
    throw new Error(`Restored application login smoke check returned HTTP ${login.status}`);
  }
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .find((value) => value.startsWith("zhilian_session="));
  if (!cookie) {
    throw new Error("Restored application login smoke check did not return a session cookie");
  }

  const createSession = await smokeFetch(new URL("/api/v1/practice-sessions", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin },
    body: JSON.stringify({ mode: "exam", levelCode }),
  });
  if (!createSession.ok) {
    throw new Error(`Restored application practice smoke check returned HTTP ${createSession.status}`);
  }
  const session = (await createSession.json()) as {
    id?: unknown;
    questions?: Array<{ id?: unknown; options?: Array<{ id?: unknown }> }>;
  };
  const sessionId = typeof session.id === "string" ? session.id : "";
  const firstQuestion = session.questions?.[0];
  const questionId = typeof firstQuestion?.id === "string" ? firstQuestion.id : "";
  const optionId = typeof firstQuestion?.options?.[0]?.id === "string" ? firstQuestion.options[0].id : "";
  if (!sessionId || !questionId || !optionId) {
    throw new Error("Restored application practice smoke check returned no answerable question");
  }

  const submit = await smokeFetch(new URL(`/api/v1/practice-sessions/${encodeURIComponent(sessionId)}/submit`, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin },
    body: JSON.stringify({ answers: [{ questionId, selectedOptionIds: [optionId] }] }),
  });
  if (!submit.ok) {
    throw new Error(`Restored application exam submission smoke check returned HTTP ${submit.status}`);
  }
  return { status: "verified" as const, origin, levelCode, sessionId, publicQuestionId: questionId, checks: ["ready", "login", "public-question-snapshot", "practice-start", "answer", "submit"] };
}

async function runRestoreDrill(options: Options) {
  const startedAt = new Date();
  const manifestPath = typeof options.manifest === "string" ? resolveFromProject(options.manifest) : "unconfigured";
  const attemptedTarget = {
    id: process.env.BACKUP_RESTORE_TARGET_ID?.trim() || "unconfigured",
    environment: process.env.BACKUP_RESTORE_ENVIRONMENT?.trim() || "unconfigured",
    databaseName: typeof options["database-name"] === "string" ? options["database-name"] : process.env.BACKUP_DATABASE_NAME ?? "practice",
    composeProject: typeof options["compose-project"] === "string" ? options["compose-project"] : process.env.BACKUP_RESTORE_COMPOSE_PROJECT?.trim() || "unconfigured",
  };
  let target = attemptedTarget;
  let restoreResult: Awaited<ReturnType<typeof restoreBackup>> | undefined;
  let operationError: unknown;
  try {
    const validatedTarget = validateIsolatedRestoreTarget({
      isolationConfirmed: process.env.BACKUP_RESTORE_ISOLATED,
      environment: process.env.BACKUP_RESTORE_ENVIRONMENT,
      targetId: process.env.BACKUP_RESTORE_TARGET_ID,
      isolationRoot: option(options, "isolation-root", process.env.BACKUP_RESTORE_ISOLATION_ROOT),
      composeFile: resolveFromProject(option(options, "compose-file", process.env.BACKUP_COMPOSE_FILE ?? "docker-compose.prod.yml")),
      databaseName: databaseName(options),
      composeProject: typeof options["compose-project"] === "string" ? options["compose-project"] : process.env.BACKUP_RESTORE_COMPOSE_PROJECT,
    });
    target = validatedTarget;
    await runCommand("docker", dockerComposeArgs(options, "up", "-d"));
    restoreResult = await restoreBackup(options);
    return { target, restore: restoreResult };
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    appendRestoreDrillRecord(drillLogFile(options), createRestoreDrillRecord({
      backupId: path.basename(manifestPath),
      startedAt,
      completedAt: new Date(),
      target,
      checks: operationError ? undefined : restoreResult,
      error: operationError,
    }));
  }
}
async function restoreBackup(options: Options) {
  const root = backupRoot(options);
  const manifestPath = resolveFromProject(option(options, "manifest"));
  const key = encryptionKey();
  const manifestKey = manifestAuthKey();
  const verified = verifyManifestArtifact(manifestPath, root, manifestKey);
  manifestKey.fill(0);
  const encryptedSnapshot = snapshotVerifiedArtifact(verified.encryptedPath, verified.manifest.encryptedSha256);
  const restoreTemporaryDirectory = option(options, "restore-temp-directory", process.env.BACKUP_RESTORE_TMP_DIRECTORY ?? "/dev/shm");
  if (!restoreTemporaryDirectory.startsWith("/")) {
    throw new Error("BACKUP_RESTORE_TMP_DIRECTORY must be an absolute container path");
  }
  const temporaryRestoreFile = `${restoreTemporaryDirectory.replace(/\/+$/, "")}/practice-restore-${crypto.randomUUID()}.sql`;
  let appStopped = false;
  let databaseValidated = false;
  let stagingAttempted = false;
  let databaseValidation;
  let operationError: unknown;
  try {
    const capacity = await runCommand(
      "docker",
      dockerComposeArgs(options, "exec", "-T", databaseService(options), "sh", "-c", `df -Pk ${shellQuote(restoreTemporaryDirectory)} | awk 'NR==2 {print $4}'`),
    );
    const availableBytes = Number(capacity.stdout) * 1024;
    if (!Number.isSafeInteger(availableBytes) || availableBytes < verified.manifest.encryptedSize + 16 * 1024 * 1024) {
      throw new Error(`Restore temporary storage has insufficient free space: ${restoreTemporaryDirectory}`);
    }
    const plaintext = new PassThrough();
    const stageCommand = `umask 077; cat > ${shellQuote(temporaryRestoreFile)}`;
    const stageResult = runCommand(
      "docker",
      dockerComposeArgs(options, "exec", "-T", databaseService(options), "sh", "-c", stageCommand),
      plaintext,
    );
    stagingAttempted = true;
    const decryptionResult = decryptBackupToWritable(encryptedSnapshot, plaintext, key);
    let header;
    try {
      [header] = await Promise.all([decryptionResult, stageResult]);
    } catch (error) {
      plaintext.destroy(error instanceof Error ? error : new Error("Backup staging failed"));
      await Promise.allSettled([decryptionResult, stageResult]);
      throw error;
    }
    if (header.keyId !== verified.manifest.encryption.keyId) {
      throw new Error("Backup manifest key ID does not match the authenticated backup header");
    }
    await runCommand("docker", dockerComposeArgs(options, "stop", applicationService(options)));
    appStopped = true;
    const importCommand = `exec mysql -u practice -p"$MYSQL_PASSWORD" ${shellQuote(databaseName(options))} < ${shellQuote(temporaryRestoreFile)}`;
    await runCommand(
      "docker",
      dockerComposeArgs(options, "exec", "-T", databaseService(options), "sh", "-c", importCommand),
    );
    databaseValidation = await validateRestoredDatabase(options, verified.manifest);
    databaseValidated = true;
  } catch (error) {
    operationError = error;
  } finally {
    key.fill(0);
    fs.rmSync(encryptedSnapshot, { force: true });
    const finalizationErrors: Error[] = [];
    if (stagingAttempted) {
      try {
        await runCommand(
          "docker",
          dockerComposeArgs(options, "exec", "-T", databaseService(options), "rm", "-f", temporaryRestoreFile),
        );
      } catch (error) {
        finalizationErrors.push(error instanceof Error ? error : new Error("Failed to remove restore temporary file"));
      }
    }
    if (appStopped && databaseValidated) {
      try {
        await runCommand("docker", dockerComposeArgs(options, "up", "-d"));
      } catch (error) {
        finalizationErrors.push(error instanceof Error ? error : new Error("Failed to restart application after restore"));
      }
    }
    if (operationError || finalizationErrors.length) {
      const errors = [...(operationError ? [operationError] : []), ...finalizationErrors];
      throw new AggregateError(errors, operationError ? "Restore failed" : "Restore finalization failed");
    }
  }
  const applicationValidation = await verifyRestoredApplication(options);
  return {
    restoredFrom: verified.encryptedPath,
    migrationVersion: verified.manifest.migrationVersion,
    databaseValidation,
    applicationValidation,
  };
}

async function execute(command: string | undefined, options: Options) {
  switch (command) {
    case "backup":
      return runBackup(options);
    case "cleanup":
      {
        const key = manifestAuthKey();
        try {
          return cleanupBackups(backupRoot(options), retentionPolicy(options), key);
        } finally {
          key.fill(0);
        }
      }
    case "offline-copy":
      {
        const key = manifestAuthKey();
        try {
          return copyBackupOffline(
            resolveFromProject(option(options, "manifest")),
            backupRoot(options),
            resolveFromProject(option(options, "offline-root", process.env.BACKUP_OFFLINE_DIRECTORY)),
            key,
          );
        } finally {
          key.fill(0);
        }
      }
    case "verify": {
      const key = encryptionKey();
      const manifestKey = manifestAuthKey();
      try {
        const verified = verifyManifestArtifact(resolveFromProject(option(options, "manifest")), backupRoot(options), manifestKey);
        const header = await verifyEncryptedBackup(verified.encryptedPath, key);
        if (header.keyId !== verified.manifest.encryption.keyId) {
          throw new Error("Backup manifest key ID does not match the authenticated backup header");
        }
        return { verified: verified.encryptedPath, sha256: verified.manifest.encryptedSha256 };
      } finally {
        manifestKey.fill(0);
        key.fill(0);
      }
    }
    case "restore":
    case "restore-drill":
      return runRestoreDrill(options);
    default:
      throw new Error("Usage: backup-cli.ts <backup|cleanup|offline-copy|verify|restore|restore-drill> [options]");
  }
}

async function main() {
  let parsed: ReturnType<typeof parseArguments> = { command: undefined, options: {} };
  try {
    parsed = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.exitCode = await runReportedOperation("argument-validation", logFile({}), async () => {
      throw error;
    });
    return;
  }
  process.exitCode = await runReportedOperation(parsed.command ?? "unknown", logFile(parsed.options), () => execute(parsed.command, parsed.options));
}

void main();
