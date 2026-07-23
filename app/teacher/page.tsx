import { AlertCircle, BookOpenCheck, CheckCircle2, FileSpreadsheet, Layers3, Target, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getDaysAgo } from "@/lib/server/time";

export default async function TeacherPage() {
  const sevenDaysAgo = getDaysAgo(7);
  const [levels, activeQuestions, knowledgeCount, studentCount, recentSessions, importCount] = await Promise.all([
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.question.findMany({ where: { status: "ACTIVE" }, select: { levelId: true, type: true } }),
    prisma.knowledgePoint.count({ where: { enabled: true } }),
    prisma.user.count({ where: { role: "STUDENT", enabled: true } }),
    prisma.practiceSession.findMany({ where: { status: "COMPLETED", completedAt: { gte: sevenDaysAgo } }, select: { correctCount: true, singleCountSnapshot: true, multipleCountSnapshot: true } }),
    prisma.importBatch.count({ where: { status: "COMMITTED" } }),
  ]);
  const totalAnswered = recentSessions.reduce((sum, session) => sum + session.singleCountSnapshot + session.multipleCountSnapshot, 0);
  const totalCorrect = recentSessions.reduce((sum, session) => sum + session.correctCount, 0);
  const accuracy = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0;
  return <AppShell role="teacher" currentPath="/teacher"><div className="safe-bottom"><PageHeader title="题库运行概览" description="数据来自 PostgreSQL。配置修改、导入批次和学生练习会实时反映在此处。" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={BookOpenCheck} label="启用题目" value={String(activeQuestions.length)} helper="单选与多选合计" /><StatCard icon={Target} label="知识点" value={String(knowledgeCount)} helper="包含父级和末级节点" tone="blue" /><StatCard icon={UsersRound} label="学生账号" value={String(studentCount)} helper="教师创建的启用账号" tone="amber" /><StatCard icon={CheckCircle2} label="近7日正确率" value={`${accuracy}%`} helper={`${recentSessions.length} 次已完成练习`} tone="rose" /></div><div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><Card><CardHeader><CardTitle>各等级题库库存</CardTitle><CardDescription>综合练习配置必须小于等于实际可用库存</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{levels.map((level) => { const items=activeQuestions.filter((question)=>question.levelId===level.id); const singles=items.filter((question)=>question.type==="SINGLE_CHOICE").length; const multiples=items.length-singles; return <div key={level.id} className="grid items-center gap-4 rounded-2xl bg-[var(--muted)] p-4 sm:grid-cols-[1fr_2fr]"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--ink)] font-black text-white">{level.code}</div><div><div className="font-extrabold">{level.name}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">启用中</div></div></div><div className="grid grid-cols-2 gap-3"><Inventory label="单选题" value={singles} /><Inventory label="多选题" value={multiples} /></div></div>; })}</CardContent></Card><Card><CardHeader><CardTitle>系统状态</CardTitle><CardDescription>数据库和关键业务模块运行情况</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><Notice icon={Layers3} tone="green" title="双维度抽题可用" description="等级综合与知识点专项均已持久化" /><Notice icon={FileSpreadsheet} tone="blue" title={`${importCount} 个已提交导入批次`} description="Excel 预检和确认入库已启用" /><Notice icon={AlertCircle} tone="amber" title="AI 解析尚未开放" description="将在第二阶段加入教师审核流程" /></CardContent></Card></div></div></AppShell>;
}
function Inventory({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[var(--surface-soft)] px-4 py-3"><div className="text-xs text-[var(--muted-foreground)]">{label}</div><div className="stat-number mt-1 text-xl font-extrabold">{value}</div></div>; }
function Notice({ icon: Icon, tone, title, description }: { icon: typeof AlertCircle; tone: "amber" | "blue" | "green"; title: string; description: string }) { const style={amber:"bg-amber-400/10 text-amber-200",blue:"bg-cyan-400/10 text-cyan-200",green:"bg-emerald-400/10 text-emerald-200"}[tone]; return <div className="flex gap-3 rounded-2xl border border-[var(--border)] p-4"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${style}`}><Icon className="size-5" /></div><div><div className="font-bold">{title}</div><div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</div></div></div>; }
