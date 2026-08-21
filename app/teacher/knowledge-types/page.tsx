import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KnowledgePointTypeManager } from "@/components/knowledge-point-type-manager";
import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/server/api";

export default async function KnowledgeTypesPage({ searchParams }: { searchParams: Promise<{ typeId?: string }> }) {
  await requireTeacher();
  const params = await searchParams;
  const types = await prisma.knowledgePointType.findMany({
    include: { _count: { select: { points: true } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  const activeType = types.find((type) => type.id === params.typeId) ?? types[0] ?? null;
  const points = activeType
    ? await prisma.knowledgePoint.findMany({
        where: { typeId: activeType.id },
        include: { _count: { select: { children: true, questions: true } } },
        orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      })
    : [];

  return (
    <AppShell role="teacher" currentPath="/teacher/knowledge-types">
      <div className="safe-bottom">
        <PageHeader
          title="知识点类型维护"
          description="维护知识点类型字典，并在每个类型下动态维护知识点树；停用类型后保留已有树，不再用于新增知识点与导入向导。"
        />
        <KnowledgePointTypeManager
          types={types.map((type) => ({
            id: type.id,
            code: type.code,
            name: type.name,
            sortOrder: type.sortOrder,
            enabled: type.enabled,
            updatedAt: type.updatedAt.toISOString(),
            pointCount: type._count.points,
          }))}
          points={points.map((point) => ({
            id: point.id,
            parentId: point.parentId,
            code: point.code,
            name: point.name,
            depth: point.depth,
            sortOrder: point.sortOrder,
            enabled: point.enabled,
            version: point.version,
            childCount: point._count.children,
            questionCount: point._count.questions,
          }))}
          selectedTypeId={activeType?.id ?? null}
        />
      </div>
    </AppShell>
  );
}
