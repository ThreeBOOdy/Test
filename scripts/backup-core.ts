import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Writable } from "node:stream";

const MAGIC = Buffer.from("PRBKUP01", "ascii");
const LENGTH_BYTES = 4;
const AUTH_TAG_BYTES = 16;
const MAX_HEADER_BYTES = 64 * 1024;

export type BackupManifest = {
  formatVersion: 1;
  databaseName: string;
  databaseVersion: string;
  applicationCommit: string;
  migrationVersion: string;
  createdAt: string;
  encryptedFile: string;
  encryptedSize: number;
  encryptedSha256: string;
  encryption: {
    algorithm: "aes-256-gcm";
    keyId: string;
  };
  restore: {
    composeFile: string;
    databaseService: string;
    applicationService: string;
  };
  authentication: {
    algorithm: "hmac-sha256";
    value: string;
  };
};

export type RetentionPolicy = {
  now: Date;
  daily: number;
  weekly: number;
  monthly: number;
};

export type RestoreEvidence = {
  migrationVersion: string;
  tableCounts: Record<string, number>;
  activeLoginAccounts: number;
  enabledRadioCourses: number;
  sensitiveFields: "verified" | "not-present";
  sensitiveFieldKeyIds?: string[];
};

type EncryptionHeader = {
  algorithm: "aes-256-gcm";
  iv: string;
  keyId: string;
};

function requireEncryptionKey(key: Buffer) {
  if (key.length !== 32) {
    throw new Error("Backup encryption key must be exactly 32 bytes");
  }
}

function requireManifestAuthKey(key: Buffer) {
  if (key.length !== 32) {
    throw new Error("Backup manifest authentication key must be exactly 32 bytes");
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function authenticateManifest(manifest: Omit<BackupManifest, "authentication">, key: Buffer) {
  requireManifestAuthKey(key);
  return crypto.createHmac("sha256", key).update(stableSerialize(manifest), "utf8").digest("base64url");
}

function sha256File(file: string) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function temporaryPath(target: string) {
  return `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.partial`;
}

function finishWritable(stream: fs.WriteStream) {
  return new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

export async function encryptBackupStream(input: Readable, target: string, key: Buffer, keyId: string) {
  requireEncryptionKey(key);
  if (!keyId.trim()) {
    throw new Error("Backup encryption key ID is required");
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const partial = temporaryPath(target);
  const iv = crypto.randomBytes(12);
  const header: EncryptionHeader = { algorithm: "aes-256-gcm", iv: iv.toString("base64"), keyId };
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  const headerLength = Buffer.alloc(LENGTH_BYTES);
  headerLength.writeUInt32BE(headerBytes.length);
  const authenticatedHeader = Buffer.concat([MAGIC, headerLength, headerBytes]);
  const output = fs.createWriteStream(partial, { flags: "wx" });

  try {
    output.write(authenticatedHeader);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(authenticatedHeader);
    await pipeline(input, cipher, output, { end: false });
    output.write(cipher.getAuthTag());
    await finishWritable(output);
    fs.renameSync(partial, target);
    return { algorithm: "aes-256-gcm" as const, keyId };
  } catch (error) {
    output.destroy();
    fs.rmSync(partial, { force: true });
    throw error;
  }
}

function readEncryptionEnvelope(source: string) {
  const descriptor = fs.openSync(source, "r");
  try {
    const prefix = Buffer.alloc(MAGIC.length + LENGTH_BYTES);
    if (fs.readSync(descriptor, prefix, 0, prefix.length, 0) !== prefix.length || !prefix.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error("Unsupported encrypted backup format");
    }
    const headerLength = prefix.readUInt32BE(MAGIC.length);
    if (headerLength <= 0 || headerLength > MAX_HEADER_BYTES) {
      throw new Error("Invalid encrypted backup header length");
    }
    const headerBytes = Buffer.alloc(headerLength);
    if (fs.readSync(descriptor, headerBytes, 0, headerLength, prefix.length) !== headerLength) {
      throw new Error("Truncated encrypted backup header");
    }
    const header = JSON.parse(headerBytes.toString("utf8")) as EncryptionHeader;
    if (header.algorithm !== "aes-256-gcm") {
      throw new Error("Unsupported backup encryption algorithm");
    }
    const iv = Buffer.from(header.iv, "base64");
    if (iv.length !== 12) {
      throw new Error("Invalid encrypted backup IV");
    }
    const authenticatedHeader = Buffer.concat([prefix, headerBytes]);
    const size = fs.fstatSync(descriptor).size;
    const ciphertextStart = authenticatedHeader.length;
    const authTagStart = size - AUTH_TAG_BYTES;
    if (authTagStart < ciphertextStart) {
      throw new Error("Truncated encrypted backup payload");
    }
    const authTag = Buffer.alloc(AUTH_TAG_BYTES);
    fs.readSync(descriptor, authTag, 0, AUTH_TAG_BYTES, authTagStart);
    return { authenticatedHeader, authTag, ciphertextStart, authTagStart, header };
  } finally {
    fs.closeSync(descriptor);
  }
}

export async function decryptBackupToWritable(source: string, output: Writable, key: Buffer) {
  requireEncryptionKey(key);
  const envelope = readEncryptionEnvelope(source);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.header.iv, "base64"));
  decipher.setAAD(envelope.authenticatedHeader);
  decipher.setAuthTag(envelope.authTag);
  const input = fs.createReadStream(source, {
    start: envelope.ciphertextStart,
    end: envelope.authTagStart - 1,
  });
  try {
    await pipeline(input, decipher, output);
  } catch (error) {
    throw new Error(`Backup authentication or integrity verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  return envelope.header;
}

export async function verifyEncryptedBackup(source: string, key: Buffer) {
  return decryptBackupToWritable(
    source,
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
    key,
  );
}

export async function decryptBackupFile(source: string, target: string, key: Buffer) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const partial = temporaryPath(target);
  try {
    await decryptBackupToWritable(source, fs.createWriteStream(partial, { flags: "wx" }), key);
    fs.renameSync(partial, target);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
}

export function createBackupManifest(input: {
  encryptedFile: string;
  databaseName: string;
  databaseVersion: string;
  applicationCommit: string;
  migrationVersion: string;
  createdAt: Date;
  keyId: string;
  composeFile: string;
  databaseService: string;
  applicationService: string;
}, manifestAuthKey: Buffer): BackupManifest {
  const stat = fs.lstatSync(input.encryptedFile);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Encrypted backup artifact is not a file");
  }
  const manifest = {
    formatVersion: 1,
    databaseName: input.databaseName,
    databaseVersion: input.databaseVersion,
    applicationCommit: input.applicationCommit,
    migrationVersion: input.migrationVersion,
    createdAt: input.createdAt.toISOString(),
    encryptedFile: path.basename(input.encryptedFile),
    encryptedSize: stat.size,
    encryptedSha256: sha256File(input.encryptedFile),
    encryption: { algorithm: "aes-256-gcm", keyId: input.keyId },
    restore: {
      composeFile: input.composeFile,
      databaseService: input.databaseService,
      applicationService: input.applicationService,
    },
  } satisfies Omit<BackupManifest, "authentication">;
  return {
    ...manifest,
    authentication: {
      algorithm: "hmac-sha256",
      value: authenticateManifest(manifest, manifestAuthKey),
    },
  };
}

export function writeBackupManifest(manifestPath: string, manifest: BackupManifest) {
  const partial = temporaryPath(manifestPath);
  fs.writeFileSync(partial, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(partial, manifestPath);
}

export function readBackupManifest(manifestPath: string, manifestAuthKey: Buffer) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupManifest;
  if (
    manifest.formatVersion !== 1 ||
    manifest.encryption?.algorithm !== "aes-256-gcm" ||
    !manifest.createdAt ||
    !manifest.encryptedFile ||
    !manifest.encryptedSha256 ||
    manifest.authentication?.algorithm !== "hmac-sha256" ||
    !manifest.authentication.value
  ) {
    throw new Error(`Invalid backup manifest: ${manifestPath}`);
  }
  if (path.basename(manifest.encryptedFile) !== manifest.encryptedFile) {
    throw new Error(`Backup manifest encryptedFile must be a base name: ${manifestPath}`);
  }
  if (path.basename(manifestPath) !== `${manifest.encryptedFile}.manifest.json`) {
    throw new Error(`Backup manifest name does not match its encrypted artifact: ${manifestPath}`);
  }
  const { authentication, ...unsignedManifest } = manifest;
  const expected = Buffer.from(authenticateManifest(unsignedManifest, manifestAuthKey), "base64url");
  const actual = Buffer.from(authentication.value, "base64url");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error(`Backup manifest authentication failed: ${manifestPath}`);
  }
  return manifest;
}

function isoWeekKey(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
}

function keepNewestBuckets(manifests: BackupManifest[], count: number, bucket: (date: Date) => string) {
  const retained = new Set<string>();
  const buckets = new Set<string>();
  for (const manifest of manifests) {
    const key = bucket(new Date(manifest.createdAt));
    if (!buckets.has(key) && buckets.size < count) {
      buckets.add(key);
      retained.add(manifest.encryptedFile);
    }
  }
  return retained;
}

export function selectBackupsToRetain(manifests: BackupManifest[], policy: RetentionPolicy) {
  for (const value of [policy.daily, policy.weekly, policy.monthly]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Backup retention counts must be non-negative integers");
    }
  }
  const now = policy.now.getTime();
  for (const manifest of manifests) {
    const timestamp = new Date(manifest.createdAt).getTime();
    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid backup creation time: ${manifest.createdAt}`);
    }
    if (timestamp > now) {
      throw new Error(`Backup creation time is in the future: ${manifest.createdAt}`);
    }
  }
  const sorted = [...manifests].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const retained = new Set<string>();
  const groups = [
    keepNewestBuckets(sorted, policy.daily, (date) => date.toISOString().slice(0, 10)),
    keepNewestBuckets(sorted, policy.weekly, isoWeekKey),
    keepNewestBuckets(sorted, policy.monthly, (date) => date.toISOString().slice(0, 7)),
  ];
  for (const group of groups) {
    for (const file of group) {
      retained.add(file);
    }
  }
  return retained;
}

export function validateRestoreEvidence(manifest: BackupManifest, evidence: RestoreEvidence) {
  if (evidence.migrationVersion !== manifest.migrationVersion) {
    throw new Error(
      `Restored migration version mismatch: expected ${manifest.migrationVersion}, received ${evidence.migrationVersion}`,
    );
  }
  for (const table of ["User", "Course", "Question", "PracticeSession"]) {
    const count = evidence.tableCounts[table];
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid restored table count for ${table}`);
    }
  }
  if (evidence.tableCounts.User < 1 || evidence.activeLoginAccounts < 1) {
    throw new Error("Restored database has no active login account");
  }
  if (evidence.tableCounts.Course < 1 || evidence.enabledRadioCourses !== 1) {
    throw new Error("Restored database must contain exactly one enabled RADIO course");
  }
  if (evidence.tableCounts.Question < 1) {
    throw new Error("Restored database has no practice questions");
  }
  return evidence;
}

export function assertPathInside(root: string, candidate: string) {
  const lexicalRoot = path.resolve(root);
  const lexicalCandidate = path.resolve(candidate);
  const lexicalRelative = path.relative(lexicalRoot, lexicalCandidate);
  if (lexicalRelative.startsWith(`..${path.sep}`) || lexicalRelative === ".." || path.isAbsolute(lexicalRelative)) {
    throw new Error(`Resolved path is outside the configured root: ${lexicalCandidate}`);
  }
  let current = lexicalRoot;
  for (const segment of lexicalRelative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed inside the configured root: ${current}`);
    }
  }
  const resolvedRoot = fs.realpathSync.native(lexicalRoot);
  let existingPath = path.resolve(candidate);
  const missingSegments: string[] = [];
  while (!fs.existsSync(existingPath)) {
    const parent = path.dirname(existingPath);
    if (parent === existingPath) {
      throw new Error(`Cannot resolve candidate path: ${candidate}`);
    }
    missingSegments.unshift(path.basename(existingPath));
    existingPath = parent;
  }
  const resolvedCandidate = path.join(fs.realpathSync.native(existingPath), ...missingSegments);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`Resolved path is outside the configured root: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

export function cleanupBackups(root: string, policy: RetentionPolicy, manifestAuthKey: Buffer) {
  const resolvedRoot = path.resolve(root);
  const entries = fs
    .readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".backup.manifest.json"))
    .map((entry) => {
      const manifestPath = assertPathInside(resolvedRoot, path.join(resolvedRoot, entry.name));
      return { manifestPath, manifest: readBackupManifest(manifestPath, manifestAuthKey) };
    });
  const retained = selectBackupsToRetain(
    entries.map((entry) => entry.manifest),
    policy,
  );
  const removed: string[] = [];
  for (const entry of entries) {
    if (retained.has(entry.manifest.encryptedFile)) {
      continue;
    }
    const encryptedPath = assertPathInside(resolvedRoot, path.join(resolvedRoot, entry.manifest.encryptedFile));
    const encryptedStat = fs.lstatSync(encryptedPath);
    const manifestStat = fs.lstatSync(entry.manifestPath);
    if (!encryptedStat.isFile() || encryptedStat.isSymbolicLink() || !manifestStat.isFile() || manifestStat.isSymbolicLink()) {
      throw new Error(`Backup artifact is not a regular file: ${encryptedPath}`);
    }
    const tombstoneDirectory = assertPathInside(resolvedRoot, path.join(resolvedRoot, `.delete-${crypto.randomUUID()}`));
    fs.mkdirSync(tombstoneDirectory);
    const tombstoneEncrypted = path.join(tombstoneDirectory, path.basename(encryptedPath));
    const tombstoneManifest = path.join(tombstoneDirectory, path.basename(entry.manifestPath));
    let encryptedMoved = false;
    let manifestMoved = false;
    try {
      fs.renameSync(encryptedPath, tombstoneEncrypted);
      encryptedMoved = true;
      fs.renameSync(entry.manifestPath, tombstoneManifest);
      manifestMoved = true;
      fs.rmSync(tombstoneDirectory, { recursive: true, force: true });
    } catch (error) {
      const rollbackErrors: Error[] = [];
      if (manifestMoved) {
        try {
          fs.renameSync(tombstoneManifest, entry.manifestPath);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError instanceof Error ? rollbackError : new Error("Manifest rollback failed"));
        }
      }
      if (encryptedMoved) {
        try {
          fs.renameSync(tombstoneEncrypted, encryptedPath);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError instanceof Error ? rollbackError : new Error("Backup rollback failed"));
        }
      }
      if (rollbackErrors.length === 0) {
        fs.rmSync(tombstoneDirectory, { recursive: true, force: true });
      }
      throw new AggregateError(
        [error instanceof Error ? error : new Error("Backup cleanup failed"), ...rollbackErrors],
        rollbackErrors.length ? `Backup cleanup rollback failed; preserve ${tombstoneDirectory}` : "Backup cleanup failed",
      );
    }
    removed.push(entry.manifest.encryptedFile);
  }
  return { retained: [...retained], removed };
}

export function copyBackupOffline(manifestPath: string, backupRoot: string, offlineRoot: string, manifestAuthKey: Buffer) {
  const resolvedManifest = assertPathInside(backupRoot, manifestPath);
  const manifest = readBackupManifest(resolvedManifest, manifestAuthKey);
  const source = assertPathInside(backupRoot, path.join(backupRoot, manifest.encryptedFile));
  const sourceHash = sha256File(source);
  if (sourceHash !== manifest.encryptedSha256) {
    throw new Error(`Source backup checksum mismatch: ${manifest.encryptedFile}`);
  }
  fs.mkdirSync(offlineRoot, { recursive: true });
  const target = assertPathInside(offlineRoot, path.join(offlineRoot, manifest.encryptedFile));
  const targetManifest = assertPathInside(offlineRoot, path.join(offlineRoot, path.basename(resolvedManifest)));
  if (fs.existsSync(target) || fs.existsSync(targetManifest)) {
    throw new Error(`Offline backup generation already exists: ${manifest.encryptedFile}`);
  }
  const partial = temporaryPath(target);
  const partialManifest = temporaryPath(targetManifest);
  try {
    fs.copyFileSync(source, partial);
    const targetHash = sha256File(partial);
    if (targetHash !== manifest.encryptedSha256) {
      throw new Error(`Offline backup checksum mismatch: ${manifest.encryptedFile}`);
    }
    fs.renameSync(partial, target);
    fs.copyFileSync(resolvedManifest, partialManifest);
    try {
      fs.renameSync(partialManifest, targetManifest);
    } catch (error) {
      fs.rmSync(target, { force: true });
      throw error;
    }
    return { encryptedFile: target, manifestFile: targetManifest, sha256: targetHash };
  } catch (error) {
    fs.rmSync(partial, { force: true });
    fs.rmSync(partialManifest, { force: true });
    throw error;
  }
}

export function verifyManifestArtifact(manifestPath: string, backupRoot: string, manifestAuthKey: Buffer) {
  const resolvedManifest = assertPathInside(backupRoot, manifestPath);
  const manifest = readBackupManifest(resolvedManifest, manifestAuthKey);
  const encryptedPath = assertPathInside(backupRoot, path.join(backupRoot, manifest.encryptedFile));
  const actualHash = sha256File(encryptedPath);
  if (actualHash !== manifest.encryptedSha256) {
    throw new Error(`Backup checksum mismatch: ${manifest.encryptedFile}`);
  }
  return { manifest, encryptedPath };
}

export function snapshotVerifiedArtifact(source: string, expectedSha256: string) {
  const stat = fs.lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Backup artifact is not a regular file: ${source}`);
  }
  const snapshot = temporaryPath(source);
  try {
    fs.copyFileSync(source, snapshot, fs.constants.COPYFILE_EXCL);
    const snapshotHash = sha256File(snapshot);
    if (snapshotHash !== expectedSha256) {
      throw new Error(`Backup snapshot checksum mismatch: ${path.basename(source)}`);
    }
    return snapshot;
  } catch (error) {
    fs.rmSync(snapshot, { force: true });
    throw error;
  }
}

function writeOperationRecord(logFile: string, record: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`, "utf8");
}

export async function runReportedOperation(
  action: string,
  logFile: string,
  operation: () => Promise<unknown>,
  reporter: (message: string) => void = (message) => console.log(message),
) {
  const startedAt = new Date();
  try {
    const result = await operation();
    const record = {
      timestamp: new Date().toISOString(),
      level: "info",
      status: "succeeded",
      action,
      durationMs: Date.now() - startedAt.getTime(),
      result,
    };
    writeOperationRecord(logFile, record);
    reporter(JSON.stringify(record));
    return 0;
  } catch (error) {
    const record = {
      timestamp: new Date().toISOString(),
      level: "error",
      status: "failed",
      action,
      durationMs: Date.now() - startedAt.getTime(),
      message: error instanceof Error ? error.message : "Unknown backup operation failure",
    };
    try {
      writeOperationRecord(logFile, record);
    } catch (logError) {
      Object.assign(record, { logFailure: logError instanceof Error ? logError.message : "Unknown log failure" });
    }
    reporter(JSON.stringify(record));
    return 1;
  }
}
