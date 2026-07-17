import type {
  ImportQuestionRow,
  QuestionOption,
  QuestionType,
  ValidatedQuestionRow,
  ValidationIssue,
} from "@/lib/domain/types";

const OPTION_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ANSWER_SEPARATORS = /[,，、|/\s]+/;
const SPEC_PATTERN = /^(\d+)\s*选\s*(\d+)$/;
const MC_PATTERN = /MC(\d+)/i;

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

  return { row, options, correctOptionIds, optionCount, correctOptionCount, selectionSpec, type, issues };
}

