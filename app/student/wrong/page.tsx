import Link from "next/link";
import { AlertTriangle, BookX, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";

export default async function WrongPage() {
  const user = await getCurrentUser();
  const wrongItems = user ? await prisma.wrongQuestion.findMany({ where: { userId: user.id }, include: { question: { include: { level: true, knowledgePoint: true } } }, orderBy: [{ mastered: "asc" }, { lastWrongAt: "desc" }] }) : [];
  const pending = wrongItems.filter((item) => !item.mastered).length;
  const mastered = wrongItems.length - pending;
  return <AppShell role="student" currentPath="/student/wrong"><div className="safe-bottom"><PageHeader title="我的错题" description="错题由服务端自动记录；再次答对后会标记为已掌握，但历史错误次数继续保留。" action={<Link href="/student" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white"><Target className="size-4" />选择知识点巩固</Link>} /><div className="mb-5 flex gap-2"><Badge tone="red">待巩固 {pending}</Badge><Badge>已掌握 {mastered}</Badge></div><div className="grid gap-4">{wrongItems.length ? wrongItems.map((item) => <Card key={item.id} className={item.mastered ? "opacity-70" : ""}><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700"><BookX className="size-5" /></div><div className="flex-1"><div className="font-extrabold leading-6">{item.question.stem}</div><div className="mt-2 flex flex-wrap gap-2"><Badge>{item.question.knowledgePoint.code} {item.question.knowledgePoint.name}</Badge><Badge tone="green">{item.question.level.code}级</Badge><Badge tone="amber">{item.question.selectionSpec}</Badge>{item.mastered ? <Badge tone="green">已掌握</Badge> : null}</div></div><div className="flex items-center gap-2 text-sm font-semibold text-rose-700"><AlertTriangle className="size-4" />错 {item.wrongCount} 次</div></CardContent></Card>) : <Card><CardContent className="p-12 text-center text-sm text-[var(--muted-foreground)]">暂无错题，继续保持。</CardContent></Card>}</div></div></AppShell>;
}
