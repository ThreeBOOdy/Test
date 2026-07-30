import { Prisma } from "@/generated/prisma/client";
import { Activity, BarChart3, Brain, CircleCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

type KnowledgeStatRow = { code: string; name: string; answered: number | bigint | string; correct: number | bigint | string };
type StudentStatRow = { username: string; displayName: string; answered: number | bigint | string; correct: number | bigint | string; sessions: number | bigint | string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = Math.min(365, Math.max(1, Number(params.days) || 30));
  const since = new Date(); since.setDate(since.getDate() - days);
  const [sessions, answered, correct, activeRows, knowledgeStats, studentStats] = await Promise.all([
    prisma.practiceSession.count({ where: { courseId: RADIO_COURSE_ID, startedAt: { gte: since } } }),
    prisma.practiceAnswer.count({ where: { courseId: RADIO_COURSE_ID, submittedAt: { gte: since } } }),
    prisma.practiceAnswer.count({ where: { courseId: RADIO_COURSE_ID, submittedAt: { gte: since }, isCorrect: true } }),
    prisma.$queryRaw<Array<{ count: number | bigint | string }>>(Prisma.sql`SELECT CAST(COUNT(DISTINCT \`userId\`) AS SIGNED) AS count FROM \`PracticeSession\` WHERE \`courseId\` = ${RADIO_COURSE_ID} AND \`startedAt\` >= ${since}`),
    prisma.$queryRaw<KnowledgeStatRow[]>(Prisma.sql`SELECT kp.code, kp.name, CAST(COUNT(pa.id) AS SIGNED) AS answered, CAST(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END) AS SIGNED) AS correct FROM \`PracticeAnswer\` pa JOIN \`Question\` q ON q.id = pa.\`questionId\` AND q.\`courseId\` = pa.\`courseId\` JOIN \`KnowledgePoint\` kp ON kp.id = q.\`knowledgePointId\` AND kp.\`courseId\` = q.\`courseId\` WHERE pa.\`courseId\` = ${RADIO_COURSE_ID} AND pa.\`submittedAt\` >= ${since} GROUP BY kp.id, kp.code, kp.name ORDER BY (COUNT(pa.id) - SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END)) DESC, COUNT(pa.id) DESC LIMIT 10`),
    prisma.$queryRaw<StudentStatRow[]>(Prisma.sql`SELECT u.username, u.\`displayName\`, CAST(COUNT(pa.id) AS SIGNED) AS answered, CAST(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END) AS SIGNED) AS correct, CAST(COUNT(DISTINCT ps.id) AS SIGNED) AS sessions FROM \`User\` u JOIN \`PracticeSession\` ps ON ps.\`userId\` = u.id AND ps.\`courseId\` = ${RADIO_COURSE_ID} LEFT JOIN \`PracticeAnswer\` pa ON pa.\`sessionId\` = ps.id AND pa.\`courseId\` = ps.\`courseId\` AND pa.\`submittedAt\` >= ${since} WHERE u.role = 'STUDENT' AND ps.\`startedAt\` >= ${since} GROUP BY u.id, u.username, u.\`displayName\` ORDER BY COUNT(pa.id) DESC LIMIT 20`),
  ]);
  const activeStudents = Number(activeRows[0]?.count ?? 0);
  const normalizedKnowledgeStats = knowledgeStats.map((item) => ({ ...item, answered: Number(item.answered), correct: Number(item.correct) }));
  const normalizedStudentStats = studentStats.map((item) => ({ ...item, answered: Number(item.answered), correct: Number(item.correct), sessions: Number(item.sessions) }));
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  return <AppShell role="teacher" currentPath="/teacher/reports"><div className="safe-bottom"><PageHeader title="教学统计" description={`最近 ${days} 天的基础运营与学习质量数据。`} action={<form><select name="days" defaultValue={String(days)} className="h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-bold"><option value="7">最近 7 天</option><option value="30">最近 30 天</option><option value="90">最近 90 天</option><option value="365">最近一年</option></select><button className="ml-2 h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white">查看</button></form>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={BarChart3} label="练习次数" value={String(sessions)} helper={`最近 ${days} 天`} /><StatCard icon={Activity} label="活跃学生" value={String(activeStudents)} helper="至少开始一次练习" tone="blue" /><StatCard icon={CircleCheck} label="累计正确率" value={`${accuracy}%`} helper={`${correct} / ${answered || 0} 题`} /><StatCard icon={Brain} label="覆盖知识点" value={String(normalizedKnowledgeStats.length)} helper="错误量最高的前 10 项" tone="rose" /></div><div className="mt-7 grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>薄弱知识点</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{normalizedKnowledgeStats.map((item) => <div key={item.code} className="flex items-center gap-3 rounded-xl bg-[var(--muted)] p-3"><div className="flex-1"><div className="font-bold">{item.code} · {item.name}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">答题 {item.answered} 次</div></div><div className="font-extrabold">{item.answered ? Math.round(item.correct / item.answered * 100) : 0}%</div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>学生学习明细</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{normalizedStudentStats.map((item) => <div key={item.username} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"><div className="flex-1"><div className="font-bold">{item.displayName}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{item.username} · {item.sessions} 次练习 · {item.answered} 题</div></div><div className="font-extrabold">{item.answered ? Math.round(item.correct / item.answered * 100) : 0}%</div></div>)}</CardContent></Card></div></div></AppShell>;
}
