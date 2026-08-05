import { ApiError } from "./api-error";
import type { DocxImage, DocxParagraph } from "./docx-content";
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

/** 结构化解析行：文本 + 该行位置的嵌入图片（docx 段落按换行切分）。 */
export type WordParseLine = {
  text: string;
  images?: DocxImage[];
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
 * - 首个题号之前的模板说明文字自动跳过，空行忽略；纯文本行为与结构化入口一致。
 * - 无选项题目按顺序判定为判断题/填空题/简答题并逐题报错，均带 `第 N 题` 位置，
 *   不产生可入库行。
 * - 材料题从 `[材料题]` 到 `[材料题结束]`（或文档结束）整块报错并给出位置，
 *   块内行不拆成顶层题。
 * - 文档中没有任何题号/题目时抛出 `未找到题目`；缺答案由后续行校验报错。
 *
 * 该入口只接收纯文本行；含图 docx 请使用 `parseWordContent`。
 */
export function parseWordQuestions(lines: readonly string[]): WordParseResult {
  return parseStructuredLines(lines.map((text) => ({ text })));
}

/**
 * 将结构化段落（文本 + 嵌入图片）解析为逐题导入行。
 *
 * 图片按所在段落当前的字段归属：题干段落 → `stemImages`；选项行 → 对应
 * `optionImages`；答案行/解析行中的图片忽略且不报错；孤立图片段落并入题干
 * （与现有文本解析一致，不向题干文本写入空行）。纯文本文档的输出与
 * `parseWordQuestions` 完全一致。
 */
export function parseWordContent(paragraphs: readonly DocxParagraph[]): WordParseResult {
  const lines: WordParseLine[] = [];
  for (const paragraph of paragraphs) {
    for (const line of paragraph.lines) {
      lines.push({ text: line.text, images: line.images });
    }
  }
  return parseStructuredLines(lines);
}

function parseStructuredLines(lines: readonly WordParseLine[]): WordParseResult {
  const rows: ImportQuestionRow[] = [];
  const errors: WordParseError[] = [];
  let index = 0;
  let rowNumber = 0;

  while (index < lines.length && !QUESTION_NUMBER_PATTERN.test(lines[index].text)) {
    index += 1;
  }
  if (index >= lines.length) throw new ApiError("未找到题目", 400);

  while (index < lines.length) {
    const numberLine = lines[index].text;
    const numberMatch = QUESTION_NUMBER_PATTERN.exec(numberLine);
    if (!numberMatch) {
      index += 1;
      continue;
    }
    const questionNumber = Number(numberMatch[1] ?? numberMatch[2]);
    rowNumber += 1;
    index += 1;

    let firstLine = stripIndeterminateAnnotation(numberLine.slice(numberMatch[0].length));
    let firstLineIndex = index - 1;
    if (!firstLine.trim()) {
      const nextLine = lines[index]?.text.trimEnd() ?? "";
      const strippedNext = stripIndeterminateAnnotation(nextLine);
      if (strippedNext !== nextLine) {
        firstLineIndex = index;
        index += 1;
        firstLine = strippedNext;
      }
    }

    if (MATERIAL_ANNOTATION_PATTERN.test(firstLine) || hasMaterialMarkerBeforeNextQuestion(lines, index)) {
      while (index < lines.length && !lines[index].text.includes(MATERIAL_END_ANNOTATION)) index += 1;
      if (index < lines.length) index += 1;
      rejectQuestion(errors, rowNumber, questionNumber, "材料题暂不支持导入");
      continue;
    }

    const stemLines: Array<{ text: string; images: DocxImage[] }> = [];
    const stemImages: DocxImage[] = [];
    const optionValues: Record<string, string> = {};
    const optionImages: Record<string, DocxImage[]> = {};
    const optionLines: Record<string, Array<{ text: string; images: DocxImage[] }>> = {};
    let rawAnswer = "";
    let explanation = "";
    let explanationStarted = false;
    let hasAnswerLine = false;
    let nextOptionId = "A";
    let optionOverflow = false;

    if (firstLine.trim()) {
      stemLines.push({ text: firstLine.trimEnd(), images: lines[firstLineIndex].images ?? [] });
      stemImages.push(...(lines[firstLineIndex].images ?? []));
    }

    while (index < lines.length) {
      const current = lines[index].text.trimEnd();
      const lineImages = lines[index].images ?? [];
      if (!current.trim()) {
        if (!explanationStarted && lineImages.length) {
          stemLines.push({ text: "", images: lineImages });
          stemImages.push(...lineImages);
        }
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
          (optionImages[optionId] ??= []).push(...lineImages);
          (optionLines[optionId] ??= []).push({ text: optionValues[optionId], images: lineImages });
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
        stemLines.push({ text: current.trimEnd(), images: lineImages });
        stemImages.push(...lineImages);
      }
      index += 1;
    }

    let stem = stemLines.map((line) => line.text).join("\n").trim();
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
    const assignedOptionImages = Object.entries(optionImages).filter(([, images]) => images.length);
    if (stemImages.length) row.stemImages = stemImages;
    if (assignedOptionImages.length) {
      row.optionImages = Object.fromEntries(assignedOptionImages);
      row.optionLines = optionLines;
    }
    if (stemImages.length || assignedOptionImages.length) row.stemLines = stemLines;
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

function hasMaterialMarkerBeforeNextQuestion(lines: readonly WordParseLine[], start: number): boolean {
  for (let index = start; index < lines.length; index += 1) {
    const current = lines[index].text.trim();
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
