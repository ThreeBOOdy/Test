import Link from "next/link";
import { AlertTriangle, ArrowRight, BookX, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const wrongItems = [
  { title: "安全用电应做到哪些？", point: "4.1.2 电源与电流", level: "A级", spec: "4选3", count: 2 },
  { title: "下列哪些材料通常属于绝缘体？", point: "4.1.1 导体与绝缘体", level: "A级", spec: "4选3", count: 1 },
  { title: "电阻的国际单位是？", point: "4.1.3 电压、电阻与功率", level: "A级", spec: "4选1", count: 1 },
];
export default function WrongPage() { return <AppShell role="student" currentPath="/student/wrong"><div className="safe-bottom"><PageHeader title="我的错题" description="按知识点重新练习，答对后标记为已掌握，但历史错误记录会继续保留。" action={<Link href="/student/practice?mode=knowledge&level=A&knowledge=kp-411" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white"><Target className="size-4" />开始巩固</Link>} /><div className="mb-5 flex gap-2"><Badge tone="red">待巩固 12</Badge><Badge>已掌握 26</Badge></div><div className="grid gap-4">{wrongItems.map((item) => <Card key={item.title}><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700"><BookX className="size-5" /></div><div className="flex-1"><div className="font-extrabold leading-6">{item.title}</div><div className="mt-2 flex flex-wrap gap-2"><Badge>{item.point}</Badge><Badge tone="green">{item.level}</Badge><Badge tone="amber">{item.spec}</Badge></div></div><div className="flex items-center gap-4"><div className="flex items-center gap-2 text-sm font-semibold text-rose-700"><AlertTriangle className="size-4" />错 {item.count} 次</div><ArrowRight className="size-4 text-[var(--muted-foreground)]" /></div></CardContent></Card>)}</div></div></AppShell>; }
