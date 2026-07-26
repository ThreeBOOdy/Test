import { AppShell } from "@/components/app-shell";
import { GradeManager } from "@/components/grade-manager";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

export default async function AdminGradesPage() {
  const grades = await prisma.grade.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return <AppShell role="admin" currentPath="/admin/grades"><div className="safe-bottom"><PageHeader title="年级配置" description={`共配置 ${grades.length} 个年级。启用的年级可供学生注册和账号导入使用。`} /><GradeManager grades={grades.map((grade) => ({ id: grade.id, code: grade.code, name: grade.name, sortOrder: grade.sortOrder, enabled: grade.enabled, updatedAt: grade.updatedAt.toISOString(), studentCount: grade._count.students }))} /></div></AppShell>;
}
