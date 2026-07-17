import { AppShell } from "@/components/app-shell";
import { ImportPreview } from "@/components/import-preview";
import { PageHeader } from "@/components/page-header";

export default function ImportPage() { return <AppShell role="teacher" currentPath="/teacher/import"><div className="safe-bottom"><PageHeader title="Excel 题库导入" description="系统自动识别题型、答案和选项规格，并用题目编号中的 MC 数量进行辅助校验。" /><ImportPreview /></div></AppShell>; }
