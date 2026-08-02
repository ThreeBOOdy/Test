import type {
  ImportQuestionRow,
  QuestionOption,
  QuestionType,
  ValidatedQuestionRow,
  ValidationIssue,
} from "@/lib/domain/types";

export type ImportDuplicateKind = "EXACT" | "CONFLICT" | "SUSPECT";

type ComparableQuestion = {
  externalQuestionCode?: string | null;
  stem: string;
  options: unknown;
  correctOptionIds: unknown;
};

const OPTION_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ANSWER_SEPARATORS = /[,，、|/\s]+/;
const SPEC_PATTERN = /^(\d+)\s*选\s*(\d+)$/;
const MC_PATTERN = /MC(\d+)/i;
const ORDER_DEPENDENCY_PATTERN = /(?:选项\s*[A-H]|答案\s*[A-H]|[A-H]\s*(?:选项|答案)|第\s*[一二三四五六七八九十\d]+\s*(?:项|个选项)|(?:第|最后|首|第一|第二|第三|第四)\s*(?:项|个选项)|以上(?:说法|选项))/i;

export function normalizeAnswer(rawAnswer: string): string[] {
  const normalized = rawAnswer.trim().toUpperCase();
  if (!normalized) return [];

  const parts = ANSWER_SEPARATORS.test(normalized)
    ? normalized.split(ANSWER_SEPARATORS)
    : normalized.split("");

  return [...new Set(parts.map((item) => item.trim()).filter(Boolean))].sort();
}

export function parseSelectionSpec(value?: string): { optionCount: number; correctOptionCount: number } | null {
  if (!value) return null;
  const match = value.trim().match(SPEC_PATTERN);
  if (!match) return null;
  return { optionCount: Number(match[1]), correctOptionCount: Number(match[2]) };
}

export function inferQuestionType(correctOptionCount: number): QuestionType {
  return correctOptionCount === 1 ? "SINGLE_CHOICE" : "MULTIPLE_CHOICE";
}

export function normalizeQuestionContent(value: unknown): string {
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  if (Array.isArray(value)) return `[${value.map(normalizeQuestionContent).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${key}:${normalizeQuestionContent(item)}`).join(",")}}`;
  }
  return String(value ?? "");
}

export function importQuestionContentKey(question: Pick<ComparableQuestion, "stem" | "options" | "correctOptionIds">): string {
  return [normalizeQuestionContent(question.stem), normalizeQuestionContent(question.options), normalizeQuestionContent(question.correctOptionIds)].join("|");
}

export function classifyImportDuplicate(candidate: ComparableQuestion, existing: ComparableQuestion): ImportDuplicateKind | null {
  const candidateCode = candidate.externalQuestionCode?.trim();
  const existingCode = existing.externalQuestionCode?.trim();
  if (candidateCode && existingCode && candidateCode === existingCode) {
    return importQuestionContentKey(candidate) === importQuestionContentKey(existing) ? "EXACT" : "CONFLICT";
  }
  return !candidateCode && importQuestionContentKey(candidate) === importQuestionContentKey(existing) ? "SUSPECT" : null;
}

export function importRowLocation(row: Pick<ImportQuestionRow, "rowNumber" | "sheetName" | "locationLabel">): string {
  if (row.locationLabel) return row.locationLabel;
  return row.sheetName ? `${row.sheetName}!${row.rowNumber}` : `第 ${row.rowNumber} 行`;
}

export function findBatchDuplicateRows(rows: ValidatedQuestionRow[]): Map<string, string> {
  const firstRowByIdentity = new Map<string, string>();
  const duplicates = new Map<string, string>();
  for (const item of rows) {
    if (item.issues.some((issue) => issue.severity === "error")) continue;
    const code = item.row.externalQuestionCode?.trim();
    const identity = code ? `code:${item.row.levelCode.trim()}|${code}` : `content:${importQuestionContentKey({ stem: item.row.stem, options: item.options, correctOptionIds: item.correctOptionIds })}`;
    const location = importRowLocation(item.row);
    const firstRow = firstRowByIdentity.get(identity);
    if (firstRow) duplicates.set(location, firstRow);
    else firstRowByIdentity.set(identity, location);
  }
  return duplicates;
}

export function validateImportRow(row: ImportQuestionRow): ValidatedQuestionRow {
  const issues: ValidationIssue[] = [];
  const options: QuestionOption[] = OPTION_IDS.flatMap((id) => {
    const text = row.optionValues[id]?.trim();
    return text ? [{ id, text }] : [];
  });
  const optionIds = new Set(options.map((option) => option.id));
  const correctOptionIds = normalizeAnswer(row.rawAnswer);
  const optionCount = options.length;
  const correctOptionCount = correctOptionIds.length;
  const selectionSpec = `${optionCount}选${correctOptionCount}`;
  const type = inferQuestionType(correctOptionCount);
  const declaredSpec = parseSelectionSpec(row.declaredSelectionSpec);

  if (!row.levelCode.trim()) issues.push({ severity: "error", field: "等级", message: "等级不能为空" });
  if (!row.categoryCode.trim()) issues.push({ severity: "error", field: "分类号", message: "分类号不能为空" });
  if (!row.stem.trim()) issues.push({ severity: "error", field: "问题", message: "题干不能为空" });
  if (optionCount < 2) issues.push({ severity: "error", field: "选项", message: "至少需要两个有效选项" });
  if (correctOptionCount === 0) issues.push({ severity: "error", field: "答案", message: "答案不能为空" });

  for (const answerId of correctOptionIds) {
    if (!optionIds.has(answerId)) {
      issues.push({ severity: "error", field: "答案", message: `答案 ${answerId} 没有对应的有效选项` });
    }
  }

  if (declaredSpec && (declaredSpec.optionCount !== optionCount || declaredSpec.correctOptionCount !== correctOptionCount)) {
    issues.push({
      severity: "error",
      field: "选项规格",
      message: `填写为 ${row.declaredSelectionSpec}，实际应为 ${selectionSpec}`,
    });
  } else if (row.declaredSelectionSpec && !declaredSpec) {
    issues.push({ severity: "error", field: "选项规格", message: "格式应为“4选1”或“4选2”" });
  }

  const mcMatch = row.externalQuestionCode?.match(MC_PATTERN);
  if (mcMatch && Number(mcMatch[1]) !== correctOptionCount) {
    issues.push({
      severity: "warning",
      field: "题目编号",
      message: `${row.externalQuestionCode} 暗示 ${mcMatch[1]} 个答案，但实际答案有 ${correctOptionCount} 个`,
    });
  }

  if (!row.preserveOptionOrder && ORDER_DEPENDENCY_PATTERN.test(row.stem)) {
    issues.push({ severity: "warning", field: "题干", message: "题干可能依赖选项字母、序号或位置；默认会随机选项，请确认后勾选“保持选项顺序”" });
  }

  return { row, options, correctOptionIds, optionCount, correctOptionCount, selectionSpec, type, issues };
}

