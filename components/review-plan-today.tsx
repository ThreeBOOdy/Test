"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Brain, CheckCircle2, Circle, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicReviewCard, PublicReviewPlan } from "@/lib/domain/review-plan";

export function ReviewPlanToday({ plan }: { plan: PublicReviewPlan }) {
  const router = useRouter();
  const [cards, setCards] = useState(plan.cards);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function complete(card: PublicReviewCard) {
    setPendingId(card.id);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/review-plans/${plan.id}/cards/${card.id}/complete`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "完成复习任务失败");
        return;
      }
      setCards((current) => current.map((item) => item.id === card.id ? { ...item, status: "COMPLETED", completedAt: data.completedAt ?? null } : item));
      router.refresh();
    } catch {
      setMessage("完成复习任务失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  }

  const completedCount = cards.filter((card) => card.status === "COMPLETED").length;
  const pendingCards = cards.filter((card) => card.status === "PENDING");
  const doneCards = cards.filter((card) => card.status === "COMPLETED");

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold">今日复习计划</div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">规则引擎生成 · 不依赖 AI</div>
          </div>
          <Badge tone={plan.status === "COMPLETED" ? "green" : "blue"}>{completedCount} / {cards.length} 已完成</Badge>
        </div>
        {message ? <div className="mt-3 text-sm text-rose-300">{message}</div> : null}
        {cards.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted-foreground)]">今天暂时没有需要复习的题目，保持状态即可。</div>
        ) : (
          <div className="mt-5 space-y-3">
            {pendingCards.map((card) => <ReviewCardRow key={card.id} card={card} pending={pendingId === card.id} onComplete={() => complete(card)} />)}
            {doneCards.map((card) => <ReviewCardRow key={card.id} card={card} pending={false} onComplete={() => undefined} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewCardRow({ card, pending, onComplete }: { card: PublicReviewCard; pending: boolean; onComplete: () => void }) {
  const isDone = card.status === "COMPLETED";
  const Icon = card.source === "WRONG_QUESTION" ? Brain : Target;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${isDone ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]"}`}>
          {isDone ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{card.knowledgeName} · {card.levelCode}级</div>
          <div className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--muted-foreground)]">{card.stem}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={card.source === "WRONG_QUESTION" ? "red" : "blue"}>{card.source === "WRONG_QUESTION" ? "错题巩固" : "薄弱专项"}</Badge>
            <Link href={card.launchHref as never} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)]">进入练习<ArrowRight className="size-3" /></Link>
          </div>
        </div>
      </div>
      {!isDone ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onComplete} className="shrink-0">
          {pending ? "处理中" : <><Circle className="mr-1 size-3" />完成</>}
        </Button>
      ) : null}
    </div>
  );
}
