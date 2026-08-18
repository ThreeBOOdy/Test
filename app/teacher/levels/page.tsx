import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { LevelManager } from "@/components/level-manager";
import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/server/api";

export default async function LevelsPage() {
  await requireTeacher();
  const levels = await prisma.level.findMany({
    include: { _count: { select: { questions: true } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return <AppShell role="teacher" currentPath="/teacher/levels"><div className="safe-bottom"><PageHeader title="字母类维护" description="新增、编辑或停用 A/B/C/K/AA 等字母类题库；停用后不出现在归类向导与练习入口。" /><LevelManager levels={levels.map((level) => ({ id: level.id, code: level.code, name: level.name, sortOrder: level.sortOrder, enabled: level.enabled, updatedAt: level.updatedAt.toISOString(), questionCount: level._count.questions }))} /></div></AppShell>;
}
