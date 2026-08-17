"use client";

import { Skull, Swords, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BossBattle({
  mode,
  total,
  passingCount,
  correct = 0,
}: {
  mode: "exam" | "result";
  total: number;
  passingCount?: number;
  correct?: number;
}) {
  const passingRate = total > 0 && passingCount != null ? Math.round((passingCount / total) * 100) : 0;
  const accuracy = mode === "result" && total > 0 ? Math.round((correct / total) * 100) : 0;
  const damage = accuracy;
  const remaining = Math.max(0, 100 - damage);
  const defeated = mode === "result" && passingCount != null && correct >= passingCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-rose-300/20 bg-[linear-gradient(145deg,rgba(30,8,14,.9),rgba(10,5,12,.96))] text-slate-100">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl border border-rose-300/20 bg-rose-400/10 text-rose-200">
            <Skull className="size-5" />
          </div>
          <div>
            <div className="font-radio text-[10px] font-bold tracking-[.14em] text-rose-300/80">MOCK EXAM BOSS</div>
            <div className="text-base font-black">信号堡垒 · 模拟考试 Boss</div>
          </div>
        </div>
        {mode === "result" ? (
          <Badge tone={defeated ? "green" : "red"}>{defeated ? "Boss 已被击败" : "Boss 未被击败"}</Badge>
        ) : (
          <Badge tone="red">通关需正确率 ≥ {passingRate}%</Badge>
        )}
      </div>

      <div className="border-t border-white/[.07] px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span className="flex items-center gap-1.5"><Swords className="size-3.5 text-rose-300" />Boss 血条</span>
          <span>{mode === "result" ? `造成 ${damage}% 伤害 · 剩余 ${remaining}%` : `当前 HP 100%`}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-black/40">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              mode === "result" && defeated ? "bg-gradient-to-r from-emerald-400 to-cyan-300" : "bg-gradient-to-r from-rose-500 to-amber-400",
            )}
            style={{ width: `${mode === "result" ? remaining : 100}%` }}
          />
          {passingRate > 0 ? (
            <div
              className="absolute inset-y-0 w-px bg-white/70"
              style={{ left: `${passingRate}%` }}
              title={`通关线 ${passingRate}%`}
            />
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>0%</span>
          <span className="flex items-center gap-1 text-slate-300"><Trophy className="size-3" />通关线 {passingRate}%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
