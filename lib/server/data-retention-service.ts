import { ImportStatus, Prisma, PrismaClient, PracticeStatus, StudentImportStatus } from "@/generated/prisma/client";
import { getRetentionCutoff, TEMPORARY_DATA_RETENTION_DAYS, type TemporaryDataRetentionCategory } from "@/lib/domain/data-retention";

const DELETE_BATCH_SIZE = 500;

type CleanupMetrics = { eligibleBefore: number; deleted: number; remaining: number };
type CleanupFailure = { category: TemporaryDataRetentionCategory; message: string; auditRecorded: boolean };
type RetentionClient = Pick<PrismaClient, "auditLog" | "authSession" | "studentActivation" | "studentImportBatch" | "importBatch" | "examDraft">;
type CleanupDefinition = {
  category: TemporaryDataRetentionCategory;
  count: (client: RetentionClient, cutoff: Date) => Promise<number>;
  findIds: (client: RetentionClient, cutoff: Date) => Promise<string[]>;
  deleteIds: (client: RetentionClient, ids: string[]) => Promise<number>;
};

export type TemporaryDataRetentionResult = {
  startedAt: string;
  finishedAt: string;
  results: Array<{ category: TemporaryDataRetentionCategory; cutoff: string; retentionDays: number; durationMs: number } & CleanupMetrics>;
  failures: CleanupFailure[];
};

async function deleteBatches(client: RetentionClient, definition: CleanupDefinition, cutoff: Date) {
  let deleted = 0;
  for (;;) {
    const ids = await definition.findIds(client, cutoff);
    if (!ids.length) return deleted;
    deleted += await definition.deleteIds(client, ids);
    if (ids.length < DELETE_BATCH_SIZE) return deleted;
  }
}

const cleanupDefinitions: CleanupDefinition[] = [
  {
    category: "authSessions",
    count: (client, cutoff) => client.authSession.count({ where: { OR: [{ idleExpiresAt: { lte: cutoff } }, { absoluteExpiresAt: { lte: cutoff } }] } }),
    findIds: async (client, cutoff) => (await client.authSession.findMany({ where: { OR: [{ idleExpiresAt: { lte: cutoff } }, { absoluteExpiresAt: { lte: cutoff } }] }, select: { id: true }, take: DELETE_BATCH_SIZE })).map((item) => item.id),
    deleteIds: async (client, ids) => (await client.authSession.deleteMany({ where: { id: { in: ids } } })).count,
  },
  {
    category: "studentActivations",
    count: (client, cutoff) => client.studentActivation.count({ where: { expiresAt: { lte: cutoff } } }),
    findIds: async (client, cutoff) => (await client.studentActivation.findMany({ where: { expiresAt: { lte: cutoff } }, select: { id: true }, take: DELETE_BATCH_SIZE })).map((item) => item.id),
    deleteIds: async (client, ids) => (await client.studentActivation.deleteMany({ where: { id: { in: ids } } })).count,
  },
  {
    category: "studentImportPreviews",
    count: (client, cutoff) => client.studentImportBatch.count({ where: studentImportPreviewWhere(cutoff) }),
    findIds: async (client, cutoff) => (await client.studentImportBatch.findMany({ where: studentImportPreviewWhere(cutoff), select: { id: true }, take: DELETE_BATCH_SIZE })).map((item) => item.id),
    deleteIds: async (client, ids) => (await client.studentImportBatch.deleteMany({ where: { id: { in: ids } } })).count,
  },
  {
    category: "questionImportPreviews",
    count: (client, cutoff) => client.importBatch.count({ where: questionImportPreviewWhere(cutoff) }),
    findIds: async (client, cutoff) => (await client.importBatch.findMany({ where: questionImportPreviewWhere(cutoff), select: { id: true }, take: DELETE_BATCH_SIZE })).map((item) => item.id),
    deleteIds: async (client, ids) => (await client.importBatch.deleteMany({ where: { id: { in: ids } } })).count,
  },
  {
    category: "settledExamDrafts",
    count: (client, cutoff) => client.examDraft.count({ where: settledExamDraftWhere(cutoff) }),
    findIds: async (client, cutoff) => (await client.examDraft.findMany({ where: settledExamDraftWhere(cutoff), select: { id: true }, take: DELETE_BATCH_SIZE })).map((item) => item.id),
    deleteIds: async (client, ids) => (await client.examDraft.deleteMany({ where: { id: { in: ids } } })).count,
  },
];

function studentImportPreviewWhere(cutoff: Date): Prisma.StudentImportBatchWhereInput {
  return { status: { in: [StudentImportStatus.PREVIEW, StudentImportStatus.FAILED, StudentImportStatus.EXPIRED] }, expiresAt: { lte: cutoff } };
}

function questionImportPreviewWhere(cutoff: Date): Prisma.ImportBatchWhereInput {
  return { status: { in: [ImportStatus.PREVIEW, ImportStatus.FAILED] }, expiresAt: { lte: cutoff } };
}

function settledExamDraftWhere(cutoff: Date): Prisma.ExamDraftWhereInput {
  return { updatedAt: { lte: cutoff }, session: { is: { status: { in: [PracticeStatus.COMPLETED, PracticeStatus.ABANDONED] } } } };
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }

async function writeFailureAudit(client: RetentionClient, category: TemporaryDataRetentionCategory, cutoff: Date, durationMs: number, error: unknown) {
  try {
    await client.auditLog.create({ data: { action: "RETENTION_CLEANUP_FAILED", targetType: "TemporaryDataRetention", targetId: category, metadata: { category, cutoff: cutoff.toISOString(), retentionDays: TEMPORARY_DATA_RETENTION_DAYS[category], durationMs, message: errorMessage(error) } } });
    return true;
  } catch { return false; }
}

export async function cleanupTemporaryData(client: RetentionClient, now = new Date()): Promise<TemporaryDataRetentionResult> {
  const startedAt = new Date();
  const results: TemporaryDataRetentionResult["results"] = [];
  const failures: CleanupFailure[] = [];
  for (const definition of cleanupDefinitions) {
    const cutoff = getRetentionCutoff(definition.category, now);
    const categoryStartedAt = Date.now();
    try {
      const eligibleBefore = await definition.count(client, cutoff);
      const deleted = await deleteBatches(client, definition, cutoff);
      const remaining = await definition.count(client, cutoff);
      const durationMs = Date.now() - categoryStartedAt;
      await client.auditLog.create({ data: { action: "RETENTION_CLEANUP_SUCCEEDED", targetType: "TemporaryDataRetention", targetId: definition.category, metadata: { category: definition.category, cutoff: cutoff.toISOString(), retentionDays: TEMPORARY_DATA_RETENTION_DAYS[definition.category], durationMs, eligibleBefore, deleted, remaining } } });
      results.push({ category: definition.category, cutoff: cutoff.toISOString(), retentionDays: TEMPORARY_DATA_RETENTION_DAYS[definition.category], durationMs, eligibleBefore, deleted, remaining });
    } catch (error) {
      failures.push({ category: definition.category, message: errorMessage(error), auditRecorded: await writeFailureAudit(client, definition.category, cutoff, Date.now() - categoryStartedAt, error) });
    }
  }
  return { startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), results, failures };
}
