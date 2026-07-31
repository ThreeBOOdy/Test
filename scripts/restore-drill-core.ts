import fs from "node:fs";
import path from "node:path";

import { assertPathInside } from "./backup-core";

export type IsolatedRestoreTarget = {
  isolationConfirmed: string | undefined;
  environment: string | undefined;
  targetId: string | undefined;
  isolationRoot: string;
  composeFile: string;
  databaseName: string;
  composeProject: string | undefined;
};

export type RestoreDrillRecord = {
  backupId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "succeeded" | "failed";
  target: {
    id: string;
    environment: string;
    databaseName: string;
    composeProject: string;
  };
  checks?: unknown;
  failureReason?: string;
  findings: string[];
};

function requiredValue(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required for an isolated restore drill`);
  return normalized;
}

function isDedicatedRestoreName(value: string) {
  return /(?:^|[_-])(restore|drill|isolated)(?:[_-]|$)/i.test(value);
}

export function validateIsolatedRestoreTarget(target: IsolatedRestoreTarget) {
  if (target.isolationConfirmed !== "true") {
    throw new Error("BACKUP_RESTORE_ISOLATED must be exactly true before a restore drill can run");
  }
  if (target.environment?.trim().toLowerCase() !== "isolated") {
    throw new Error("BACKUP_RESTORE_ENVIRONMENT must be exactly isolated before a restore drill can run");
  }
  const targetId = requiredValue(target.targetId, "BACKUP_RESTORE_TARGET_ID");
  const composeProject = requiredValue(target.composeProject, "BACKUP_RESTORE_COMPOSE_PROJECT");
  if (!path.isAbsolute(target.isolationRoot) || !fs.existsSync(target.isolationRoot) || !fs.statSync(target.isolationRoot).isDirectory()) {
    throw new Error("BACKUP_RESTORE_ISOLATION_ROOT must be an existing absolute directory");
  }
  const resolvedComposeFile = assertPathInside(target.isolationRoot, target.composeFile);
  if (!fs.statSync(resolvedComposeFile).isFile()) {
    throw new Error("Restore drill compose file must be a regular file inside BACKUP_RESTORE_ISOLATION_ROOT");
  }
  if (!isDedicatedRestoreName(target.databaseName)) {
    throw new Error("Restore drill database name must identify an isolated restore target");
  }
  if (!isDedicatedRestoreName(composeProject)) {
    throw new Error("BACKUP_RESTORE_COMPOSE_PROJECT must identify an isolated restore target");
  }
  return {
    id: targetId,
    environment: "isolated",
    databaseName: target.databaseName,
    composeProject,
    composeFile: resolvedComposeFile,
  };
}

export function createRestoreDrillRecord(input: {
  backupId: string;
  startedAt: Date;
  completedAt: Date;
  target: Pick<RestoreDrillRecord["target"], "id" | "environment" | "databaseName" | "composeProject">;
  checks?: unknown;
  error?: unknown;
}): RestoreDrillRecord {
  const failureReason = input.error instanceof Error ? input.error.message : input.error ? "Unknown restore drill failure" : undefined;
  return {
    backupId: input.backupId,
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
    durationMs: input.completedAt.getTime() - input.startedAt.getTime(),
    status: failureReason ? "failed" : "succeeded",
    target: input.target,
    ...(input.checks === undefined ? {} : { checks: input.checks }),
    ...(failureReason ? { failureReason } : {}),
    findings: failureReason ? [failureReason] : [],
  };
}

export function appendRestoreDrillRecord(file: string, record: RestoreDrillRecord) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
}