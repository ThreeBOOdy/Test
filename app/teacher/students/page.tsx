import { Prisma } from "@/generated/prisma/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { StudentManager } from "@/components/student-manager";
import { prisma } from "@/lib/db";
import { normalizePagination } from "@/lib/server/pagination";

type StudentStats = { userId: string; sessionCount: number; answered: number; correct: number; lastActive: Date | null };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const where = { role: "STUDENT" as const, ...(params.search ? { OR: [{ username: { contains: params.search, mode: "insensitive" as const } }, { displayName: { contains: params.search, mode: "insensitive" as const } }] } : {}) };
  const [students, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }), prisma.user.count({ where })]);
  const ids = students.map((student) => student.id);
  const stats = ids.length ? await prisma.$queryRaw<StudentStats[]>(Prisma.sql`SELECT ps."userId", COUNT(DISTINCT ps.id)::int AS "sessionCount", COUNT(pa.id)::int AS answered, COUNT(pa.id) FILTER (WHERE pa."isCorrect")::int AS correct, MAX(ps."startedAt") AS "lastActive" FROM "PracticeSession" ps LEFT JOIN "PracticeAnswer" pa ON pa."sessionId" = ps.id WHERE ps."userId" IN (${Prisma.join(ids)}) GROUP BY ps."userId"`) : [];
  const statsByUser = new Map(stats.map((item) => [item.userId, item]));
  const rows = students.map((student) => { const item = statsByUser.get(student.id); return { id: student.id, username: student.username, displayName: student.displayName, enabled: student.enabled, mustChangePassword: student.mustChangePassword, sessionCount: Number(item?.sessionCount ?? 0), accuracy: item?.answered ? Math.round(Number(item.correct) / Number(item.answered) * 100) : 0, lastActive: item?.lastActive?.toLocaleString("zh-CN") ?? "尚未练习" }; });
  return <AppShell role="teacher" currentPath="/teacher/students"><div className="safe-bottom"><PageHeader title="学生管理" description={`共 ${total} 个学生账号，正确率按实际提交答案计算。`} /><StudentManager students={rows} /><PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} path="/teacher/students" params={{ search: params.search }} /></div></AppShell>;
}
