import { ApiError } from "./api-error";
import type { ImportQuestionRow } from "./types";

const QUESTION_NUMBER_PATTERN = /^\s*(?:[（(](\d+)[）)]|(\d+)[.、．])\s*/;
const ANSWER_LINE_PATTERN = /^\s*答案[:：]\s*(.*)$/;
const EXPLANATION_LINE_PATTERN = /^\s*解析[:：]\s*(.*)$/;
const OPTION_LINE_PATTERN = /^\s*([A-Za-z])[、.．:：\s]+(.+)$/;
const INDETERMINATE_ANNOTATIONS = ["[不定项选择题]", "[不定项选项题]", "[不定项]"] as const;
const FULL_WIDTH_PAREN_ANSWER_PATTERN = /（([^（）()]*)）\s*$/;
const HALF_WIDTH_PAREN_ANSWER_PATTERN = /\(([^()（）]*)\)\s*$/;
const PAREN_ANSWER_CONTENT_PATTERN = /^[A-Za-z](?:[A-Za-z,，、/|\s]*[A-Za-z])?$/;
const MATERIAL_ANNOTATION_PATTERN = /^\[材料题](?!结束)/;
const MATERIAL_END_ANNOTATION = "[材料题结束]";
const JUDGMENT_ANSWERS = new Set(["正确", "错误", "对", "错"]);
const FILL_BLANK_PATTERN = /[（(]\s*[）)]/;
const FILL_ANSWER_SEPARATOR_PATTERN = /[|；]/;
const MAX_OPTION_COUNT = 8;

export type WordParseError = {
  rowNumber: number;
  locationLabel: string;
  message: string;
};

export type WordParseResult = {
  rows: ImportQuestionRow[];
  errors: WordParseError[];
};

/**
 * 将 Word 抽取出的文本行解析为逐题导入行。
 *
 * - 支持 `1.`、`1、`、`（1）` 三种题号格式（兼容全角/半角括号），题号只写入
 *   `locationLabel`，不写入题目编号。
 * - 支持 `[不定项选择题]`、`[不定项选项题]`、`[不定项]` 标注，题型沿用
 *   `inferQuestionType` 按答案个数判定。
 * - 选项按顺序解析 A–H，大小写统一转大写；超过 8 个选项逐题报错说明系统上限。
 * - 支持答案行与题干末尾括号内答案（无答案行且存在选项时）。
 * - 解析行合并到 `explanation`，保留在批次行数据，不参与行校验与写库。
 * - 首个题号之前的模板说明文字自动跳过，空行忽略。
 * - 无选项题目按顺序判定为判断题/填空题/简答题并逐题报错，均带 `第 N 题` 位置，
 *   不产生可入库行。
 * - 材料题从 `[材料题]` 到 `[材料题结束]`（或文档结束）整块报错并给出位置，
 *   块内行不拆成顶层题。
 * - 文档中没有任何题号/题目时抛出 `未找到题目`；缺答案由后续行校验报错。
 */
export function parseWordQuestions(lines: readonly string[]): WordParseResult {
  const rows: ImportQuestionRow[] = [];
  const errors: WordParseError[] = [];
  let index = 0;
  let rowNumber = 0;

  while (index < lines.length && !QUESTION_NUMBER_PATTERN.test(lines[index])) {
    index += 1;
  }
  if (index >= lines.length) throw new ApiError("未找到题目", 400);

  while (index < lines.length) {
    const numberLine = lines[index];
    const numberMatch = QUESTION_NUMBER_PATTERN.exec(numberLine);
    if (!numberMatch) {
      index += 1;
      continue;
    }
    const questionNumber = Number(numberMatch[1] ?? numberMatch[2]);
    rowNumber += 1;
    index += 1;

    let firstLine = stripIndeterminateAnnotation(numberLine.slice(numberMatch[0].length));
    if (!firstLine.trim()) {
      const nextLine = lines[index]?.trimEnd() ?? "";
      const strippedNext = stripIndeterminateAnnotation(nextLine);
      if (strippedNext !== nextLine) {
        index += 1;
        firstLine = strippedNext;
      }
    }

    if (MATERIAL_ANNOTATION_PATTERN.test(firstLine) || hasMaterialMarkerBeforeNextQuestion(lines, index)) {
      while (index < lines.length && !lines[index].includes(MATERIAL_END_ANNOTATION)) index += 1;
      if (index < lines.length) index += 1;
      rejectQuestion(errors, rowNumber, questionNumber, "材料题暂不支持导入");
      continue;
    }

    const stemLines: string[] = [];
    const optionValues: Record<string, string> = {};
    let rawAnswer = "";
    let explanation = "";
    let explanationStarted = false;
    let hasAnswerLine = false;
    let nextOptionId = "A";
    let optionOverflow = false;

    if (firstLine.trim()) stemLines.push(firstLine.trimEnd());

    while (index < lines.length) {
      const current = lines[index].trimEnd();
      if (!current.trim()) {
        index += 1;
        continue;
      }
      if (QUESTION_NUMBER_PATTERN.test(current)) break;

      const answerMatch = ANSWER_LINE_PATTERN.exec(current);
      if (answerMatch) {
        hasAnswerLine = true;
        if (answerMatch[1].trim()) rawAnswer = answerMatch[1].trim();
        index += 1;
        continue;
      }

      const optionMatch = OPTION_LINE_PATTERN.exec(current);
      if (optionMatch) {
        const optionId = optionMatch[1].toUpperCase();
        if (optionId.charCodeAt(0) > "H".charCodeAt(0)) {
          optionOverflow = true;
          index += 1;
          continue;
        }
        if (nextOptionId && optionId === nextOptionId) {
          optionValues[optionId] = optionMatch[2].trim();
          nextOptionId = nextOptionId === "H" ? "" : String.fromCharCode(nextOptionId.charCodeAt(0) + 1);
          index += 1;
          continue;
        }
      }

      const explanationMatch = EXPLANATION_LINE_PATTERN.exec(current);
      if (explanationMatch) {
        explanationStarted = true;
        if (explanationMatch[1].trim()) {
          explanation = explanation ? `${explanation}\n${explanationMatch[1].trim()}` : explanationMatch[1].trim();
        }
        index += 1;
        continue;
      }

      if (explanationStarted) {
        explanation = explanation ? `${explanation}\n${current.trimEnd()}` : current.trimEnd();
      } else {
        stemLines.push(current.trimEnd());
      }
      index += 1;
    }

    let stem = stemLines.join("\n").trim();
    const hasOptions = Object.keys(optionValues).length > 0;

    if (optionOverflow) {
      rejectQuestion(errors, rowNumber, questionNumber, `系统最多支持 ${MAX_OPTION_COUNT} 个选项`);
      continue;
    }

    if (!hasOptions) {
      const answer = rawAnswer.trim();
      if (JUDGMENT_ANSWERS.has(answer)) {
        rejectQuestion(errors, rowNumber, questionNumber, "判断题暂不支持导入");
        continue;
      }
      if (FILL_BLANK_PATTERN.test(stem) && FILL_ANSWER_SEPARATOR_PATTERN.test(rawAnswer)) {
        rejectQuestion(errors, rowNumber, questionNumber, "填空题暂不支持导入");
        continue;
      }
      rejectQuestion(errors, rowNumber, questionNumber, "简答题暂不支持导入");
      continue;
    }

    if (!hasAnswerLine) {
      const extracted = extractTrailingParentheticalAnswer(stem);
      if (extracted) {
        rawAnswer = extracted.answer;
        stem = extracted.stem;
      }
    }

    const row: ImportQuestionRow = {
      rowNumber,
      locationLabel: `第 ${questionNumber} 题`,
      levelCode: "",
      categoryCode: "",
      stem,
      rawAnswer,
      optionValues,
    };
    if (explanationStarted && explanation.trim()) row.explanation = explanation.trim();
    rows.push(row);
  }

  return { rows, errors };
}

function rejectQuestion(errors: WordParseError[], rowNumber: number, questionNumber: number, message: string): void {
  errors.push({ rowNumber, locationLabel: `第 ${questionNumber} 题`, message });
}

function stripIndeterminateAnnotation(text: string): string {
  let rest = text.trimStart();
  for (let changed = true; changed; ) {
    changed = false;
    for (const tag of INDETERMINATE_ANNOTATIONS) {
      if (rest.startsWith(tag)) {
        rest = rest.slice(tag.length).trimStart();
        changed = true;
        break;
      }
    }
  }
  return rest;
}

function hasMaterialMarkerBeforeNextQuestion(lines: readonly string[], start: number): boolean {
  for (let index = start; index < lines.length; index += 1) {
    const current = lines[index].trim();
    if (!current) continue;
    if (QUESTION_NUMBER_PATTERN.test(current)) return false;
    if (MATERIAL_ANNOTATION_PATTERN.test(current)) return true;
  }
  return false;
}

function extractTrailingParentheticalAnswer(stem: string): { stem: string; answer: string } | null {
  for (const pattern of [FULL_WIDTH_PAREN_ANSWER_PATTERN, HALF_WIDTH_PAREN_ANSWER_PATTERN]) {
    const match = pattern.exec(stem);
    if (!match) continue;
    const content = match[1].trim();
    if (!PAREN_ANSWER_CONTENT_PATTERN.test(content)) continue;
    return { stem: stem.slice(0, match.index).trimEnd(), answer: content };
  }
  return null;
}
