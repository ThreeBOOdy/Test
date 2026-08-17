import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpenCheck, CheckCircle2, Database, FileSpreadsheet, Layers3, RadioTower, Target, UsersRound, Waves } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GradeGamificationSettings } from "@/components/grade-gamification-settings";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CallsignLabel, FrequencyScale, SignalMeter } from "@/components/visual/radio-instruments";
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
  const inventories = levels.map((level) => {
    const items = activeQuestions.filter((question) => question.levelId === level.id);
    const singles = items.filter((question) => question.type === "SINGLE_CHOICE").length;
    return { level, singles, multiples: items.length - singles, total: items.length };
  });
  const maxInventory = Math.max(1, ...inventories.map((item) => item.total));

  return (
    <AppShell role="teacher" currentPath="/teacher">
      <div className="safe-bottom">
        <section className="receiver-panel instrument-grid relative overflow-hidden rounded-[30px] p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-16 size-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_55%,rgba(18,196,204,.16),transparent_42%)]" />
          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_auto] xl:items-center">
            <div><div className="flex flex-wrap items-center gap-3"><CallsignLabel value="EDU-CONTROL / 14.270" /><div className="flex items-center gap-2 text-xs font-black tracking-[0.14em] text-cyan-200"><SignalMeter value={5} label="题库雷达在线" />QUESTION BANK RADAR ONLINE</div></div><h1 className="mt-5 text-3xl font-black tracking-[-0.05em] sm:text-4xl">题库运行控制台</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">实时观察等级库存、知识点覆盖与学生练习信号。所有配置变更都会影响新建练习，不干扰进行中的任务快照。</p><div className="mt-7 flex flex-wrap gap-3"><ActionLink href="/teacher/questions" icon={BookOpenCheck}>管理题库</ActionLink><ActionLink href="/teacher/import" icon={FileSpreadsheet} secondary>导入 Excel</ActionLink></div><FrequencyScale active={5} className="mt-7 max-w-xl" /></div>
            <div className="glass-panel scan-line min-w-[280px] rounded-[24px] p-5"><div className="flex items-center justify-between"><div><div className="text-[10px] font-black tracking-[0.2em] text-cyan-100/50">ACTIVE DATABASE</div><div className="mt-1 text-lg font-black">题库信号总览</div></div><Database className="size-5 text-cyan-300" /></div><div className="mt-6 flex items-end gap-1.5">{[42,70,54,92,68,48,80,58,96,76,62,86].map((height, index) => <span key={index} className="w-full rounded-full bg-[linear-gradient(180deg,#62eee5,#118a98)]" style={{ height: `${height * .56}px` }} />)}</div><div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-400">启用题目</span><span className="stat-number text-2xl font-black">{activeQuestions.length}</span></div></div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={BookOpenCheck} label="启用题目" value={String(activeQuestions.length)} helper="单选与多选合计" />
          <StatCard icon={Target} label="知识点" value={String(knowledgeCount)} helper="包含父级和末级节点" tone="blue" />
          <StatCard icon={UsersRound} label="学生账号" value={String(studentCount)} helper="当前启用账号" tone="amber" />
          <StatCard icon={CheckCircle2} label="近7日正确率" value={`${accuracy}%`} helper={`${recentSessions.length} 次已完成练习`} tone="rose" />
        </div>

        <div className="mt-7"><GradeGamificationSettings /></div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[1.18fr_.82fr]">
          <Card className="overflow-hidden"><CardHeader className="border-b border-[var(--border)] pb-5"><div className="flex items-center justify-between gap-4"><div><div className="text-[10px] font-black tracking-[0.2em] text-[var(--primary)]">INVENTORY SPECTRUM</div><CardTitle className="mt-1">各等级题库库存</CardTitle><CardDescription>颜色条展示单选与多选的相对容量</CardDescription></div><Link href="/teacher/rules" className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary)]">配置规则<ArrowRight className="size-4" /></Link></div></CardHeader><CardContent className="flex flex-col gap-4">{inventories.map(({ level, singles, multiples, total }) => <div key={level.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--muted)]/65 p-4 transition hover:border-cyan-300 hover:bg-cyan-50/35"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--ink)] font-black text-cyan-200 shadow-lg">{level.code}</div><div><div className="font-black">{level.name}</div><div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{total} 道启用题目</div></div><div className="ml-auto flex gap-2"><Inventory label="单选" value={singles} /><Inventory label="多选" value={multiples} /></div></div><div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="bg-[linear-gradient(90deg,#0a96a2,#28c5cb)] transition-all" style={{ width: `${(singles / maxInventory) * 100}%` }} /><div className="bg-[linear-gradient(90deg,#e9a341,#ffc86d)] transition-all" style={{ width: `${(multiples / maxInventory) * 100}%` }} /></div></div>)}</CardContent></Card>

          <div className="flex flex-col gap-6">
            <Card><CardHeader><div className="text-[10px] font-black tracking-[0.2em] text-[var(--primary)]">SYSTEM SIGNALS</div><CardTitle>系统状态</CardTitle><CardDescription>数据库和关键业务模块运行情况</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><Notice icon={Layers3} tone="green" title="双维度抽题可用" description="等级综合与知识点专项均已持久化" /><Notice icon={FileSpreadsheet} tone="blue" title={`${importCount} 个已提交导入批次`} description="Excel 预检和确认入库已启用" /><Notice icon={AlertCircle} tone="amber" title="AI 解析尚未开放" description="第二阶段加入教师审核流程" /></CardContent></Card>
            <Card className="overflow-hidden bg-[var(--ink)] text-white"><CardContent className="relative"><div className="absolute -right-12 -top-12 size-40 rounded-full bg-cyan-300/10 blur-2xl" /><div className="relative flex items-start gap-4"><div className="radio-waves grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300"><RadioTower className="relative z-10 size-6" /></div><div><div className="text-[10px] font-black tracking-[0.18em] text-cyan-100/50">NEXT ACTION</div><h3 className="mt-1 text-lg font-black">保持题库信号稳定</h3><p className="mt-2 text-sm leading-6 text-slate-400">优先处理库存不足的等级与知识点组合，再向学生开放训练入口。</p><Link href="/teacher/rules" className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-cyan-300">检查抽题规则<ArrowRight className="size-4" /></Link></div></div></CardContent></Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ActionLink({ href, icon: Icon, secondary = false, children }: { href: string; icon: typeof Waves; secondary?: boolean; children: React.ReactNode }) {
  return <Link href={href as never} className={`inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-extrabold transition hover:-translate-y-0.5 ${secondary ? "border border-white/15 bg-white/[.07] text-white hover:bg-white/[.12]" : "bg-[linear-gradient(135deg,#16b8c2,#087b87)] text-white shadow-[0_14px_30px_rgba(0,185,198,.22)]"}`}><Icon className="size-4" />{children}</Link>;
}
function Inventory({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm"><div className="text-[10px] font-bold text-[var(--muted-foreground)]">{label}</div><div className="stat-number text-lg font-black text-[var(--ink)]">{value}</div></div>; }
function Notice({ icon: Icon, tone, title, description }: { icon: typeof AlertCircle; tone: "amber" | "blue" | "green"; title: string; description: string }) { const style = { amber: "bg-amber-50 text-amber-700 ring-amber-100", blue: "bg-cyan-50 text-cyan-700 ring-cyan-100", green: "bg-emerald-50 text-emerald-700 ring-emerald-100" }[tone]; return <div className="flex gap-3 rounded-2xl border border-[var(--border)] p-4 transition hover:border-cyan-200"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${style}`}><Icon className="size-5" /></div><div><div className="font-extrabold">{title}</div><div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</div></div></div>; }
