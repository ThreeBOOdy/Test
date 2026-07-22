export const IMPORT_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export function getImportBatchExpiry(createdAt: Date) {
  return new Date(createdAt.getTime() + IMPORT_PREVIEW_TTL_MS);
}

export function isImportBatchExpired(createdAt: Date, now = new Date()) {
  return now.getTime() >= getImportBatchExpiry(createdAt).getTime();
}
