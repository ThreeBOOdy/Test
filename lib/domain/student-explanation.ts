export type StudentExplanation = {
  summary: string;
  knowledge: string;
  memory: string;
};

export function parseStudentExplanation(value: string | null | undefined): StudentExplanation | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const summary = typeof record.summary === "string" ? record.summary : "";
      const knowledge = typeof record.knowledge === "string" ? record.knowledge : "";
      const memory = typeof record.memory === "string" ? record.memory : "";
      if (summary || knowledge || memory) return { summary, knowledge, memory };
    }
  } catch {
    // Stored explanation is expected to be JSON; tolerate legacy plain text.
  }
  return { summary: value, knowledge: "", memory: "" };
}
