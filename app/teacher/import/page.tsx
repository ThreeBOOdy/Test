import { AppShell } from "@/components/app-shell";
import { ImportBatchList } from "@/components/import-batch-list";
import { ImportPreview } from "@/components/import-preview";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

export default async function ImportPage() {
  const batches = await prisma.importBatch.findMany({ where: { courseId: RADIO_COURSE_ID }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, fileName: true, status: true, totalRows: true, insertedRows: true, duplicateRows: true, warningRows: true, errorRows: true, createdAt: true } });
  return <AppShell role="teacher" currentPath="/teacher/import"><div className="safe-bottom"><PageHeader title="Excel 题库导入" description="预检数据完整保存在服务器；提交和撤销操作均会记录审计日志。" /><ImportPreview /><ImportBatchList batches={batches.map((batch) => ({ ...batch, createdAt: batch.createdAt.toISOString() }))} /></div></AppShell>;
}
