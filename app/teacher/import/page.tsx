import { AppShell } from "@/components/app-shell";
import { ImportBatchList } from "@/components/import-batch-list";
import { ImportPreview } from "@/components/import-preview";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/server/api";

export default async function ImportPage() {
  const user = await requireTeacher();
  const [batches, knowledgePointTypes, levels] = await Promise.all([
    prisma.importBatch.findMany({ where: { importedById: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, fileName: true, status: true, totalRows: true, insertedRows: true, duplicateRows: true, warningRows: true, errorRows: true, createdAt: true } }),
    prisma.knowledgePointType.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true, enabled: true } }),
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true, enabled: true } }),
  ]);
  return <AppShell role="teacher" currentPath="/teacher/import"><div className="safe-bottom"><PageHeader title="题库导入" description="支持 Excel 表格与 Word 题库模板；先自动检查再导入，提交和撤销都会留下记录。" /><ImportPreview knowledgePointTypes={knowledgePointTypes.map((type) => ({ id: type.id, code: type.code, name: type.name, enabled: type.enabled }))} levels={levels.map((level) => ({ id: level.id, code: level.code, name: level.name, enabled: level.enabled }))} /><ImportBatchList batches={batches.map((batch) => ({ ...batch, createdAt: batch.createdAt.toISOString() }))} /></div></AppShell>;
}
