import { BookOpenCheck, Brain, CircleCheck, Clock3 } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import type { StudentMasteryOverview } from "@/lib/domain/learning-state";

export function StudentMasteryOverview({ overview }: { overview: StudentMasteryOverview }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded-2xl border border-cyan-600/20 bg-cyan-500/10 text-[var(--primary)]">
            <Brain className="size-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--primary)]">MASTERY OVERVIEW</div>
            <h2 className="mt-1 text-xl font-extrabold">当前掌握概览</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
              当前字母类 {overview.levelCode} · 共 {overview.total} 题
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={BookOpenCheck} label="未做" value={`${overview.notStarted}`} helper="当前字母类尚未作答" tone="blue" />
          <StatCard icon={Clock3} label="待复习" value={`${overview.due}`} helper="已到期需要复习" tone="amber" />
          <StatCard icon={Brain} label="学习中" value={`${overview.learning}`} helper="未达到掌握间隔" tone="rose" />
          <StatCard icon={CircleCheck} label="已掌握" value={`${overview.mastered}`} helper="复习间隔 ≥ 7 天" tone="green" />
        </div>
      </CardContent>
    </Card>
  );
}
