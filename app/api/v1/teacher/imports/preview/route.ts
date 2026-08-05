import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { extractDocxContent } from "@/lib/domain/docx-content";
import { getImportBatchExpiry } from "@/lib/domain/import-batch";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { classifyImportDuplicate, findBatchDuplicateRows, importRowLocation, validateImportRow } from "@/lib/domain/question-import";
import { prepareQuestionRowImages, validateQuestionImageLimits, type BatchImageRecord, type PreviewRowImage } from "@/lib/domain/question-image-marker";
import { assertRequestBodySize } from "@/lib/domain/request-body";
import type { ImportQuestionRow, ValidatedQuestionRow } from "@/lib/domain/types";
import { assertExcelHasNoImages } from "@/lib/domain/workbook-images";
import { parseWordContent, type WordParseError } from "@/lib/domain/word-question-parser";
import { assertSameOrigin } from "@/lib/server/http";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";

const aliases: Record<string, string[]> = {
  levelCode: ["等级", "级别", "level"], sourceBankCode: ["题库编号", "题库", "bank"], categoryCode: ["分类号", "知识点编号", "category"], knowledgePointName: ["知识点名称", "知识点", "categoryName"], externalQuestionCode: ["题目编号", "编号", "questionCode"], stem: ["问题", "题干", "题目"], rawAnswer: ["答案", "正确答案"], declaredSelectionSpec: ["选项规格", "规格"], preserveOptionOrder: ["保持选项顺序", "固定选项顺序", "preserveOptionOrder"], enabled: ["是否启用", "启用"],
};

export async function POST(request: Request) {
  let source: "EXCEL" | "WORD" = "EXCEL";
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    assertRequestBodySize(request, 21 * 1024 * 1024);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("请选择题库文件");
    if (file.size > 20 * 1024 * 1024) throw new ApiError("题库文件不能超过 20MB", 413);
    const fileName = file.name.toLowerCase();
    const results: ValidatedQuestionRow[] = [];
    const batchImages: BatchImageRecord[] = [];
    let sheetNames: string[];

    if (fileName.endsWith(".xlsx")) {
      source = "EXCEL";
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      await assertExcelHasNoImages(buffer);
      if (!workbook.worksheets.length) return NextResponse.json({ message: "Excel 中没有工作表" }, { status: 400 });
      sheetNames = [];
      for (const sheet of workbook.worksheets) {
        if (results.length >= 5000) break;
        const headers = new Map<string, number>();
        sheet.getRow(1).eachCell((cell, column) => headers.set(cellText(cell.value).trim(), column));
        const columnOf = (key: string) => aliases[key]?.map((alias) => headers.get(alias)).find(Boolean);
        const missing = ["levelCode", "categoryCode", "stem", "rawAnswer"].filter((key) => !columnOf(key));
        if (missing.length) throw new ApiError(`${sheet.name} 缺少必要表头：${missing.map((key) => aliases[key][0]).join("、")}`);
        sheetNames.push(sheet.name);
        const maxRows = Math.min(sheet.rowCount, 5001);
        for (let rowNumber = 2; rowNumber <= maxRows && results.length < 5000; rowNumber += 1) {
          const row = sheet.getRow(rowNumber);
          const value = (key: string) => { const column = columnOf(key); return column ? cellText(row.getCell(column).value).trim() : ""; };
          const stem = value("stem");
          if (!stem && !Object.values(row.values ?? {}).some(Boolean)) continue;
          const optionValues: Record<string, string> = {};
          for (const optionId of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
            const column = headers.get(optionId);
            if (column) optionValues[optionId] = cellText(row.getCell(column).value).trim();
          }
          const preserveOptionOrder = ["是", "1", "true", "yes", "y"].includes(value("preserveOptionOrder").toLowerCase());
          const importRow: ImportQuestionRow = { rowNumber, sheetName: sheet.name, levelCode: value("levelCode"), sourceBankCode: value("sourceBankCode"), categoryCode: value("categoryCode"), knowledgePointName: value("knowledgePointName"), externalQuestionCode: value("externalQuestionCode"), stem, rawAnswer: value("rawAnswer"), declaredSelectionSpec: value("declaredSelectionSpec"), preserveOptionOrder, optionValues, enabled: !["否", "0", "false"].includes(value("enabled").toLowerCase()) };
          results.push(validateImportRow(importRow));
        }
      }
    } else if (fileName.endsWith(".docx")) {
      source = "WORD";
      const levelCode = formText(form.get("levelCode"));
      const categoryCode = formText(form.get("categoryCode"));
      const knowledgePointName = formText(form.get("knowledgePointName")) || undefined;
      if (!levelCode) throw new ApiError("Word 导入需要选择等级");
      if (!categoryCode) throw new ApiError("Word 导入需要填写分类号");
      const parsed = parseWordContent(await extractDocxContent(await file.arrayBuffer()));
      for (const row of parsed.rows) {
        if (results.length >= 5000) break;
        const importRow = { ...row, levelCode, categoryCode, knowledgePointName };
        const prepared = prepareQuestionRowImages(importRow, importRow.rowNumber);
        importRow.stem = prepared.stem;
        importRow.optionValues = prepared.optionValues;
        const validated = validateImportRow(importRow);
        validated.issues.push(...validateQuestionImageLimits(prepared.records.map((record) => ({ mimeType: record.mimeType, sizeBytes: record.sizeBytes }))));
        results.push(validated);
        batchImages.push(...prepared.records);
      }
      for (const error of parsed.errors) {
        if (results.length >= 5000) break;
        results.push(rejectedWordRow(error, levelCode, categoryCode, knowledgePointName));
      }
      results.sort((left, right) => left.row.rowNumber - right.row.rowNumber);
      sheetNames = [];
    } else {
      throw new ApiError("仅支持 .xlsx 或 .docx 文件");
    }

    const imageHashById = new Map(batchImages.map((record) => [record.id, record.contentHash]));
    const hashById = (imageId: string) => imageHashById.get(imageId);
    const batchDuplicates = findBatchDuplicateRows(results, hashById);
    for (const item of results) {
      const firstRow = batchDuplicates.get(importRowLocation(item.row));
      if (firstRow) item.issues.push({ severity: "error", field: "重复题目", message: `与本批次 ${firstRow} 重复` });
    }

    const codedRows = results.filter((item) => item.row.externalQuestionCode?.trim());
    const existingQuestions = codedRows.length
      ? await prisma.question.findMany({
        where: {
          courseId: RADIO_COURSE_ID,
          level: { code: { in: [...new Set(codedRows.map((item) => item.row.levelCode.trim()))] } },
          externalQuestionCode: { in: [...new Set(codedRows.map((item) => item.row.externalQuestionCode!.trim()))] },
        },
        include: { level: { select: { code: true } }, images: { select: { id: true, contentHash: true } } },
      })
      : [];
    const existingByCode = new Map(existingQuestions.map((question) => [`${question.level.code}|${question.externalQuestionCode}`, question]));
    const unnumberedRows = results.filter((item) => !item.row.externalQuestionCode?.trim());
    const existingForSuspects = unnumberedRows.length
      ? await prisma.question.findMany({
        where: { courseId: RADIO_COURSE_ID },
        select: { externalQuestionCode: true, stem: true, options: true, correctOptionIds: true, images: { select: { id: true, contentHash: true } } },
      })
      : [];
    const imagesHashById = (question: { images: Array<{ id: string; contentHash: string }> }) => {
      const byId = new Map(question.images.map((image) => [image.id, image.contentHash]));
      return (imageId: string) => byId.get(imageId);
    };
    for (const item of results) {
      if (item.issues.some((issue) => issue.severity === "error")) continue;
      const existing = item.row.externalQuestionCode?.trim()
        ? existingByCode.get(`${item.row.levelCode.trim()}|${item.row.externalQuestionCode.trim()}`)
        : existingForSuspects.find((question) => classifyImportDuplicate({ ...item.row, options: item.options, correctOptionIds: item.correctOptionIds }, question, hashById, imagesHashById(question)) === "SUSPECT");
      if (!existing) continue;
      const kind = classifyImportDuplicate({ ...item.row, options: item.options, correctOptionIds: item.correctOptionIds }, existing, hashById, imagesHashById(existing));
      if (kind === "EXACT") item.issues.push({ severity: "warning", field: "重复题目", message: "与公共题库中的题目完全相同" });
      if (kind === "CONFLICT") item.issues.push({ severity: "error", field: "题目编号", message: "题目编号已存在，但题目内容不同" });
      if (kind === "SUSPECT") item.issues.push({ severity: "warning", field: "重复题目", message: "未填写题号，内容与公共题库题目相同，请人工确认" });
    }

    const validRows = results.filter((item) => item.issues.every((issue) => issue.severity !== "error")).length;
    const warningRows = results.filter((item) => item.issues.some((issue) => issue.severity === "warning")).length;
    const errorRows = results.filter((item) => item.issues.some((issue) => issue.severity === "error")).length;
    const expiresAt = getImportBatchExpiry(new Date());
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({ data: { courseId: RADIO_COURSE_ID, fileName: file.name, importedById: user.id, status: "PREVIEW", totalRows: results.length, validRows, warningRows, errorRows, expiresAt } });
      if (results.length) {
        await tx.importBatchRow.createMany({ data: results.map((item, index) => ({ batchId: created.id, rowNumber: index + 1, payload: JSON.parse(JSON.stringify(stripRowImages(item.row))) as Prisma.InputJsonValue, issues: item.issues as Prisma.InputJsonValue, valid: item.issues.every((issue) => issue.severity !== "error") })) });
      }
      if (batchImages.length) {
        await tx.importBatchImage.createMany({ data: batchImages.map((record) => ({ id: record.id, batchId: created.id, rowNumber: record.rowNumber, field: record.field, sortOrder: record.sortOrder, data: record.data, mimeType: record.mimeType, sizeBytes: record.sizeBytes, contentHash: record.contentHash })) });
      }
      return created;
    });

    const imagesByRow = new Map<number, PreviewRowImage[]>();
    for (const record of batchImages) {
      const list = imagesByRow.get(record.rowNumber) ?? [];
      list.push({ id: record.id, field: record.field, mimeType: record.mimeType, sizeBytes: record.sizeBytes });
      imagesByRow.set(record.rowNumber, list);
    }
    return NextResponse.json({
      batchId: batch.id,
      status: batch.status,
      fileName: file.name,
      source,
      sheetNames,
      stats: { totalRows: results.length, validRows, warningRows, errorRows },
      rows: results.slice(0, 100).map((item) => toPreviewItem(item, imagesByRow.get(item.row.rowNumber))),
      pagination: { page: 1, pageSize: 100, total: results.length, totalPages: Math.max(1, Math.ceil(results.length / 100)) },
      expiresAt,
    });
  } catch (error) {
    return apiErrorResponse(error, source === "WORD" ? "解析 Word 文件失败" : "解析 Excel 失败");
  }
}

function formText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function rejectedWordRow(error: WordParseError, levelCode: string, categoryCode: string, knowledgePointName?: string): ValidatedQuestionRow {
  return {
    row: {
      rowNumber: error.rowNumber,
      locationLabel: error.locationLabel,
      levelCode,
      categoryCode,
      knowledgePointName,
      stem: "",
      rawAnswer: "",
      optionValues: {},
    },
    options: [],
    correctOptionIds: [],
    optionCount: 0,
    correctOptionCount: 0,
    selectionSpec: "",
    type: "SINGLE_CHOICE",
    issues: [{ severity: "error", field: "题型", message: error.message }],
  };
}

function stripRowImages(row: ImportQuestionRow): ImportQuestionRow {
  const { stemImages: _stemImages, optionImages: _optionImages, stemLines: _stemLines, optionLines: _optionLines, ...rest } = row;
  void _stemImages;
  void _optionImages;
  void _stemLines;
  void _optionLines;
  return rest;
}

function toPreviewItem(item: ValidatedQuestionRow, images?: PreviewRowImage[]) {
  return { ...item, row: stripRowImages(item.row), images };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
    if ("result" in value) return String(value.result ?? "");
  }
  return String(value);
}
