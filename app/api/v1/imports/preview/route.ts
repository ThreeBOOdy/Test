import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { validateImportRow } from "@/lib/domain/question-import";
import type { ImportQuestionRow } from "@/lib/domain/types";
import { getCurrentUser } from "@/lib/server/session";

export const runtime = "nodejs";
const aliases: Record<string, string[]> = {
  levelCode: ["等级", "级别"], sourceBankCode: ["题库编号", "原题库编号"], categoryCode: ["分类号", "知识点编号"], knowledgePointName: ["知识点名称", "分类名称"], externalQuestionCode: ["题目编号", "试题编号"], stem: ["问题", "题干", "试题内容"], rawAnswer: ["答案", "正确答案"], declaredSelectionSpec: ["选项规格", "几选几"], enabled: ["是否启用", "启用"],
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "请选择 Excel 文件" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ message: "首版仅支持 .xlsx 文件" }, { status: 400 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return NextResponse.json({ message: "Excel 中没有工作表" }, { status: 400 });
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(cellText(cell.value).trim(), column));
    const columnOf = (key: string) => aliases[key]?.map((alias) => headers.get(alias)).find(Boolean);
    const missing = ["levelCode", "categoryCode", "stem", "rawAnswer"].filter((key) => !columnOf(key));
    if (missing.length) return NextResponse.json({ message: `缺少必要表头：${missing.map((key) => aliases[key][0]).join("、")}` }, { status: 400 });
    const results = [];
    const maxRows = Math.min(sheet.rowCount, 5001);
    for (let rowNumber = 2; rowNumber <= maxRows; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const value = (key: string) => { const column = columnOf(key); return column ? cellText(row.getCell(column).value).trim() : ""; };
      const stem = value("stem");
      if (!stem && !Object.values(row.values ?? {}).some(Boolean)) continue;
      const optionValues: Record<string, string> = {};
      for (const optionId of ["A", "B", "C", "D", "E", "F", "G", "H"]) { const column = headers.get(optionId); if (column) optionValues[optionId] = cellText(row.getCell(column).value).trim(); }
      const importRow: ImportQuestionRow = { rowNumber, levelCode: value("levelCode"), sourceBankCode: value("sourceBankCode"), categoryCode: value("categoryCode"), knowledgePointName: value("knowledgePointName"), externalQuestionCode: value("externalQuestionCode"), stem, rawAnswer: value("rawAnswer"), declaredSelectionSpec: value("declaredSelectionSpec"), optionValues, enabled: !["否", "0", "false"].includes(value("enabled").toLowerCase()) };
      results.push(validateImportRow(importRow));
    }
    return NextResponse.json({ fileName: file.name, sheetName: sheet.name, totalRows: results.length, validRows: results.filter((item) => item.issues.every((issue) => issue.severity !== "error")).length, warningRows: results.filter((item) => item.issues.some((issue) => issue.severity === "warning")).length, errorRows: results.filter((item) => item.issues.some((issue) => issue.severity === "error")).length, rows: results.slice(0, 100) });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "解析 Excel 失败" }, { status: 400 }); }
}
function cellText(value: ExcelJS.CellValue): string { if (value == null) return ""; if (typeof value === "object") { if ("richText" in value) return value.richText.map((part) => part.text).join(""); if ("text" in value) return String(value.text); if ("result" in value) return String(value.result ?? ""); } return String(value); }
