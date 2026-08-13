import { AppShell } from "@/components/app-shell";
import { KnowledgeManager } from "@/components/knowledge-manager";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

export default async function KnowledgePage() {
  const points = await prisma.knowledgePoint.findMany({ include: { _count: { select: { children: true, questions: true } } }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] });
  return <AppShell role="teacher" currentPath="/teacher/knowledge"><div className="safe-bottom"><PageHeader title="知识点目录" description={`数据库中共有 ${points.length} 个节点。新增分类号时会自动补齐缺失的父级目录。`} /><KnowledgeManager points={points.map((point) => ({ id: point.id, code: point.code, name: point.name, depth: point.depth, sortOrder: point.sortOrder, enabled: point.enabled, version: point.version, childCount: point._count.children, questionCount: point._count.questions }))} /></div></AppShell>;
}
