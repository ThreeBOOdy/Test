"use client";

import { useState } from "react";
import { CalendarCheck, Flame, Hourglass, Timer, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FocusOverview } from "@/lib/domain/types";

const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20 disabled:opacity-60";

export function FocusSessionPanel({ initial }: { initial: FocusOverview }) {
  const [overview, setOverview] = useState(initial);
  const [targetMinutes, setTargetMinutes] = useState("");
  const [targetQuestionCount, setTargetQuestionCount] = useState("");
  const [actualQuestionCount, setActualQuestionCount] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function refreshOverview() {
    const response = await fetch("/api/v1/focus-sessions", { credentials: "include", cache: "no-store" });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage({ tone: "error", text: result?.message ?? "获取专注状态失败" });
      return;
    }
    setOverview(await response.json());
  }

  async function start() {
    setMessage(null);
    const minutes = targetMinutes ? Number(targetMinutes) : undefined;
    const questions = targetQuestionCount ? Number(targetQuestionCount) : undefined;
    if (!minutes && !questions) {
      setMessage({ tone: "error", text: "请设置目标时长或目标题量" });
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/v1/focus-sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMinutes: minutes, targetQuestionCount: questions }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: result.message ?? "开始专注失败" });
        return;
      }
      setTargetMinutes("");
      setTargetQuestionCount("");
      await refreshOverview();
      setMessage({ tone: "success", text: "专注已开始，保持节奏完成目标。" });
    } catch {
      setMessage({ tone: "error", text: "连接失败，请稍后重试" });
    } finally {
      setPending(false);
    }
  }

  async function end(completed: boolean) {
    const active = overview.activeFocusSession;
    if (!active) return;
    setMessage(null);
    if (completed && active.targetQuestionCount != null) {
      const questions = actualQuestionCount ? Number(actualQuestionCount) : 0;
      if (questions <= 0) {
        setMessage({ tone: "error", text: "请填写实际完成题量" });
        return;
      }
    }
    setPending(true);
    try {
      const response = await fetch(`/api/v1/focus-sessions/${active.id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed,
          actualQuestionCount: actualQuestionCount ? Number(actualQuestionCount) : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: result.message ?? "结束专注失败" });
        return;
      }
      setActualQuestionCount("");
      await refreshOverview();
      setMessage({ tone: "success", text: completed ? "目标完成，今日打卡已记录。" : "已结束本次专注，未完成不破坏连续记录。" });
    } catch {
      setMessage({ tone: "error", text: "连接失败，请稍后重试" });
    } finally {
      setPending(false);
    }
  }

  const active = overview.activeFocusSession;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]"><Timer className="size-4" />FOCUS SESSION</div>
              <h2 className="mt-2 text-xl font-extrabold">{active ? "专注进行中" : "开始一次专注刷题"}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                {active ? "保持专注直到目标达成；提前结束不会破坏连续打卡记录。" : "设定目标时长或目标题量，完成后自动计入今日打卡。"}
              </p>
            </div>
            {active ? <div className="grid size-12 place-items-center rounded-2xl border border-cyan-600/15 bg-cyan-500/10 text-[var(--primary)]"><Hourglass className="size-5" /></div> : <div className="grid size-12 place-items-center rounded-2xl border border-cyan-600/15 bg-cyan-500/10 text-[var(--primary)]"><TimerReset className="size-5" /></div>}
          </div>

          {active ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <OverviewItem label="开始时间" value={new Date(active.startedAt).toLocaleString("zh-CN")} />
                <OverviewItem label="目标时长" value={active.targetMinutes ? `${active.targetMinutes} 分钟` : "不限"} />
                <OverviewItem label="目标题量" value={active.targetQuestionCount ? `${active.targetQuestionCount} 题` : "不限"} />
              </div>
              {active.targetQuestionCount != null ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">实际完成题量</span>
                  <input
                    type="number"
                    min={0}
                    value={actualQuestionCount}
                    onChange={(event) => setActualQuestionCount(event.target.value)}
                    className={inputClass}
                    placeholder="完成目标题量后填写"
                    disabled={pending}
                  />
                </label>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => end(true)} disabled={pending} className="flex-1"><Flame className="size-4" />完成目标</Button>
                <Button variant="outline" onClick={() => end(false)} disabled={pending} className="flex-1">提前结束</Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">目标时长（分钟）</span>
                  <input
                    type="number"
                    min={1}
                    value={targetMinutes}
                    onChange={(event) => setTargetMinutes(event.target.value)}
                    className={inputClass}
                    placeholder="例如 25"
                    disabled={pending}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">目标题量（题）</span>
                  <input
                    type="number"
                    min={1}
                    value={targetQuestionCount}
                    onChange={(event) => setTargetQuestionCount(event.target.value)}
                    className={inputClass}
                    placeholder="例如 20"
                    disabled={pending}
                  />
                </label>
              </div>
              <div>
                <Button onClick={start} disabled={pending} className="w-full sm:w-auto"><Timer className="size-4" />{pending ? "处理中…" : "开始专注"}</Button>
              </div>
            </div>
          )}

          {message ? (
            <div role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === "error" ? "border-rose-600/20 bg-rose-500/10 text-rose-700" : "border-emerald-600/20 bg-emerald-500/10 text-emerald-700"}`}>
              {message.text}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card><CardContent><div className="flex items-start gap-4"><div className="grid size-11 place-items-center rounded-2xl border border-amber-600/20 bg-amber-500/10 text-amber-700"><Flame className="size-5" /></div><div><div className="text-sm font-extrabold">连续打卡</div><div className="mt-1 text-3xl font-black text-[var(--primary)]">{overview.currentStreak} 天</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{overview.todayCheckedIn ? "今日已打卡" : "今日尚未打卡"}</div></div></div></CardContent></Card>
        <Card><CardContent><div className="flex items-start gap-4"><div className="grid size-11 place-items-center rounded-2xl border border-cyan-600/15 bg-cyan-500/10 text-cyan-700"><CalendarCheck className="size-5" /></div><div><div className="text-sm font-extrabold">今日专注</div><div className="mt-1 text-3xl font-black text-[var(--primary)]">{overview.todayFocusMinutes} 分钟</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">仅统计已完成的专注</div></div></div></CardContent></Card>
      </div>
    </div>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
      <div className="text-xs font-bold text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
