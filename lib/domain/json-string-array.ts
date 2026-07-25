export function parseJsonStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must contain a JSON array of strings`);
  }
  return [...value];
}
