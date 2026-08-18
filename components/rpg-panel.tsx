"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, Circle, Map, Power, Radio, Sparkles, Target, Trophy } from "lucide-react";
import { AiMilestoneFeedback } from "@/components/ai-milestone-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MilestoneEvent } from "@/lib/domain/gamification";
import type { PublicPlayerStatus, PublicQuest } from "@/lib/domain/rpg";

export function RpgPanel({ initial }: { initial: PublicPlayerStatus }) {
  const [status, setStatus] = useState(initial);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [mapPending, setMapPending] = useState(false);
  const [milestone, setMilestone] = useState<MilestoneEvent | null>(null);

  async function refreshStatus() {
    const response = await fetch("/api/v1/rpg/status", { credentials: "include", cache: "no-store" });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage({ tone: "error", text: result?.message ?? "获取玩家状态失败" });
      return null;
    }
    const next = await response.json() as PublicPlayerStatus;
    setStatus(next);
    return next;
  }

  async function claim(quest: PublicQuest) {
    setPendingId(quest.id);
    setMessage(null);
    setMilestone(null);
    const previousLevel = status.level;
    try {
      const response = await fetch(`/api/v1/rpg/quests/${quest.id}/complete`, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: result.message ?? "领取奖励失败" });
        return;
      }
      const next = await refreshStatus();
      setMessage({ tone: "success", text: `任务完成，获得 +${quest.xpReward} XP` });
      if (next && next.level > previousLevel) {
        setMilestone({ type: "LEVEL_UP", level: next.level, title: next.title });
      } else {
        setMilestone({ type: "QUEST_COMPLETE", questTitle: quest.title, xpReward: quest.xpReward });
      }
    } catch {
      setMessage({ tone: "error", text: "连接失败，请稍后重试" });
    } finally {
      setPendingId(null);
    }
  }

  async function toggleGamification() {
    setToggling(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/rpg/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamificationEnabled: !status.gamificationEnabled }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: result.message ?? "更新游戏化设置失败" });
        return;
      }
      setStatus(result);
      setMessage({ tone: "success", text: result.gamificationEnabled ? "游戏化已开启" : "游戏化已关闭" });
    } catch {
      setMessage({ tone: "error", text: "连接失败，请稍后重试" });
    } finally {
      setToggling(false);
    }
  }

  async function restoreMapEntry() {
    setMapPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/rpg/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapEnabled: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: result.message ?? "更新学习地图入口设置失败" });
        return;
      }
      setStatus(result);
      setMessage({ tone: "success", text: "学习地图入口已恢复显示" });
    } catch {
      setMessage({ tone: "error", text: "连接失败，请稍后重试" });
    } finally {
      setMapPending(false);
    }
  }

  const nextLevelLabel = status.nextLevelXp == null ? "已满级" : `${status.xp} / ${status.nextLevelXp} XP`;
  const progressWidth = status.nextLevelXp == null ? 100 : status.levelProgress;

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-12 place-items-center rounded-2xl border border-amber-600/20 bg-amber-500/10 text-amber-700">
              <Trophy className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--primary)]">RADIO RPG</div>
              <h2 className="mt-1 text-xl font-extrabold">Lv.{status.level} · {status.title}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">累计 {status.xp} XP · {nextLevelLabel}</p>
              <div className="mt-3 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-[var(--surface-soft)]">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-[var(--primary)] transition-all" style={{ width: `${progressWidth}%` }} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {status.gamificationEnabled && status.mapEnabled ? (
              <Link href={"/student/map" as never} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-cyan-600/20 bg-cyan-500/10 px-3 text-xs font-bold text-[var(--primary)] transition hover:bg-cyan-500/15">
                <Map className="size-3" />
                学习地图
              </Link>
            ) : null}
            {status.gamificationEnabled && !status.mapEnabled ? (
              <Button type="button" variant="outline" size="sm" disabled={mapPending} onClick={restoreMapEntry}>
                <Map className="size-3" />
                {mapPending ? "处理中" : "显示学习地图"}
              </Button>
            ) : null}
            <Badge tone={status.gamificationEnabled ? "amber" : "neutral"}>
              {status.gamificationEnabled ? "游戏化已开启" : "游戏化已关闭"}
            </Badge>
            <Button type="button" variant="outline" size="sm" disabled={toggling} onClick={toggleGamification}>
              <Power className="size-3" />
              {toggling ? "处理中" : status.gamificationEnabled ? "关闭游戏化" : "开启游戏化"}
            </Button>
          </div>
        </div>

        {message ? (
          <div role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === "error" ? "border-rose-600/20 bg-rose-500/10 text-rose-700" : "border-emerald-600/20 bg-emerald-500/10 text-emerald-700"}`}>
            {message.text}
          </div>
        ) : null}

        {milestone ? (
          <div className="mt-4">
            <AiMilestoneFeedback key={JSON.stringify(milestone)} event={milestone} />
          </div>
        ) : null}

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">今日任务</div>
            <div className="text-xs text-[var(--muted-foreground)]">完成任务后手动领取 XP</div>
          </div>
          <div className="mt-3 space-y-3">
            {status.todayQuests.map((quest) => <QuestRow key={quest.id} quest={quest} pending={pendingId === quest.id} onClaim={() => claim(quest)} />)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestRow({ quest, pending, onClaim }: { quest: PublicQuest; pending: boolean; onClaim: () => void }) {
  const done = quest.status === "COMPLETED";
  const Icon = quest.type === "FOCUS" ? Sparkles : quest.type === "WRONG_CLEAR" ? Target : quest.type === "REVIEW" ? Award : Radio;
  const progressPercent = Math.min(100, Math.round((quest.progress / quest.target) * 100));
  return (
    <div className={`rounded-2xl p-4 ${done ? "bg-emerald-400/5" : "bg-[var(--surface-soft)]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${done ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700" : "border-cyan-600/15 bg-cyan-500/10 text-[var(--primary)]"}`}>
            {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">{quest.title}</div>
            <div className="mt-1 text-xs leading-6 text-[var(--muted-foreground)]">{quest.description}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={done ? "green" : "blue"}>{quest.progress} / {quest.target}</Badge>
              <span className="text-xs font-semibold text-amber-700">+{quest.xpReward} XP</span>
            </div>
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/30">
              <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-[var(--primary)]"}`} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
        {!done ? (
          <Button type="button" variant={quest.ready ? "primary" : "outline"} size="sm" disabled={!quest.ready || pending} onClick={onClaim} className="shrink-0">
            {pending ? "处理中" : quest.ready ? <><Circle className="mr-1 size-3" />领取奖励</> : "进行中"}
          </Button>
        ) : (
          <Badge tone="green" className="shrink-0">已完成</Badge>
        )}
      </div>
    </div>
  );
}
