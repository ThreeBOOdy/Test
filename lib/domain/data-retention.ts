export const DAY_MS = 24 * 60 * 60 * 1000;

export const TEMPORARY_DATA_RETENTION_DAYS = {
  authSessions: 30,
  studentActivations: 7,
  studentImportPreviews: 0,
  questionImportPreviews: 0,
  settledExamDrafts: 7,
} as const;

export type TemporaryDataRetentionCategory = keyof typeof TEMPORARY_DATA_RETENTION_DAYS;

export function getRetentionCutoff(category: TemporaryDataRetentionCategory, now = new Date()) {
  return new Date(now.getTime() - TEMPORARY_DATA_RETENTION_DAYS[category] * DAY_MS);
}
