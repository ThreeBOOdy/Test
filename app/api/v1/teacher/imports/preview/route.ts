import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getImportBatchExpiry } from "@/lib/domain/import-batch";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { classifyImportDuplicate, findBatchDuplicateRows, importRowLocation, validateImportRow } from "@/lib/domain/question-import";
import { assertRequestBodySize } from "@/lib/domain/request-body";
import type { ImportQuestionRow, ValidatedQuestionRow } from "@/lib/domain/types";
import { assertSameOrigin } from "@/lib/server/http";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";

const aliases: Record<string, string[]> = {
  levelCode: ["等级", "级别", "level"], sourceBankCode: ["题库编号", "题库", "bank"], categoryCode: ["分类号", "知识点编号", "category"], knowledgePointName: ["知识点名称", "知识点", "categoryName"], externalQuestionCode: ["题目编号", "编号", "questionCode"], stem: ["问题", "题干", "题目"], rawAnswer: ["答案", "正确答案"], declaredSelectionSpec: ["选项规格", "规格"], preserveOptionOrder: ["保持选项顺序", "固定选项顺序", "preserveOptionOrder"], enabled: ["是否启用", "启用"],
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    assertRequestBodySize(request, 21 * 1024 * 1024);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("请选择 Excel 文件");
    if (file.size > 20 * 1024 * 1024) throw new ApiError("Excel 文件不能超过 20MB", 413);
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new ApiError("仅支持 .xlsx 文件");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    if (!workbook.worksheets.length) return NextResponse.json({ message: "Excel 中没有工作表" }, { status: 400 });
    const results: ValidatedQuestionRow[] = [];
    const sheetNames: string[] = [];
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

    const batchDuplicates = findBatchDuplicateRows(results);
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
        include: { level: { select: { code: true } } },
      })
      : [];
    const existingByCode = new Map(existingQuestions.map((question) => [`${question.level.code}|${question.externalQuestionCode}`, question]));
    const unnumberedRows = results.filter((item) => !item.row.externalQuestionCode?.trim());
    const existingForSuspects = unnumberedRows.length
      ? await prisma.question.findMany({ where: { courseId: RADIO_COURSE_ID }, select: { externalQuestionCode: true, stem: true, options: true, correctOptionIds: true } })
      : [];
    for (const item of results) {
      if (item.issues.some((issue) => issue.severity === "error")) continue;
      const existing = item.row.externalQuestionCode?.trim()
        ? existingByCode.get(`${item.row.levelCode.trim()}|${item.row.externalQuestionCode.trim()}`)
        : existingForSuspects.find((question) => classifyImportDuplicate({ ...item.row, options: item.options, correctOptionIds: item.correctOptionIds }, question) === "SUSPECT");
      if (!existing) continue;
      const kind = classifyImportDuplicate({ ...item.row, options: item.options, correctOptionIds: item.correctOptionIds }, existing);
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
        await tx.importBatchRow.createMany({ data: results.map((item, index) => ({ batchId: created.id, rowNumber: index + 1, payload: JSON.parse(JSON.stringify(item.row)) as Prisma.InputJsonValue, issues: item.issues as Prisma.InputJsonValue, valid: item.issues.every((issue) => issue.severity !== "error") })) });
      }
      return created;
    });

    return NextResponse.json({
      batchId: batch.id,
      status: batch.status,
      fileName: file.name,
      sheetNames,
      stats: { totalRows: results.length, validRows, warningRows, errorRows },
      rows: results.slice(0, 100),
      pagination: { page: 1, pageSize: 100, total: results.length, totalPages: Math.max(1, Math.ceil(results.length / 100)) },
      expiresAt,
    });
  } catch (error) {
    return apiErrorResponse(error, "解析 Excel 失败");
  }
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
