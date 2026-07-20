import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { validateImportRow } from "@/lib/domain/question-import";
import type { ImportQuestionRow } from "@/lib/domain/types";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";
import { getCurrentUser } from "@/lib/server/session";

const rowSchema = z.object({
  rowNumber: z.number().int().positive(), levelCode: z.string(), sourceBankCode: z.string().optional(), categoryCode: z.string(), knowledgePointName: z.string().optional(), externalQuestionCode: z.string().optional(), stem: z.string(), rawAnswer: z.string(), declaredSelectionSpec: z.string().optional(), optionValues: z.record(z.string(), z.string().optional()), enabled: z.boolean().optional(),
});
const schema = z.object({ fileName: z.string().min(1), rows: z.array(z.object({ row: rowSchema })).min(1).max(5000) });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "TEACHER") return NextResponse.json({ message: "需要教师权限" }, { status: 403 });
    const input = schema.parse(await request.json());
    const validated = input.rows.map((item) => validateImportRow(item.row as ImportQuestionRow));
    const invalid = validated.filter((item) => item.issues.some((issue) => issue.severity === "error"));
    if (invalid.length > 0) throw new Error(`仍有 ${invalid.length} 行错误，不能确认导入`);

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({ data: { fileName: input.fileName, importedById: user.id, status: "PREVIEW", totalRows: validated.length, validRows: validated.length, warningRows: validated.filter((item) => item.issues.some((issue) => issue.severity === "warning")).length } });
      let inserted = 0;
      let skipped = 0;
      for (const item of validated) {
        const level = await tx.level.findFirst({ where: { code: item.row.levelCode, enabled: true } });
        if (!level) throw new Error(`第 ${item.row.rowNumber} 行等级 ${item.row.levelCode} 不存在或已停用`);
        if (item.row.externalQuestionCode) {
          const duplicate = await tx.question.findFirst({ where: { externalQuestionCode: item.row.externalQuestionCode, levelId: level.id } });
          if (duplicate) { skipped += 1; continue; }
        }
        const knowledgePoint = await ensureKnowledgePoint(tx, item.row.categoryCode, item.row.knowledgePointName);
        if (!knowledgePoint.enabled) throw new Error(`第 ${item.row.rowNumber} 行知识点已停用`);
        await tx.question.create({ data: { levelId: level.id, knowledgePointId: knowledgePoint.id, sourceBankCode: item.row.sourceBankCode || null, externalQuestionCode: item.row.externalQuestionCode || null, stem: item.row.stem, type: item.type, optionCount: item.optionCount, correctOptionCount: item.correctOptionCount, selectionSpec: item.selectionSpec, options: item.options as Prisma.InputJsonValue, correctOptionIds: item.correctOptionIds, status: item.row.enabled === false ? "DISABLED" : "ACTIVE", importBatchId: batch.id } });
        inserted += 1;
      }
      await tx.importBatch.update({ where: { id: batch.id }, data: { status: "COMMITTED", committedAt: new Date(), validRows: inserted, warningRows: skipped } });
      return { batchId: batch.id, inserted, skipped };
    }, { timeout: 60_000 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "导入失败" }, { status: 400 });
  }
}
