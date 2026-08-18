"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { MilestoneEvent } from "@/lib/domain/gamification";

export function AiMilestoneFeedback({ event }: { event: MilestoneEvent }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const eventKey = JSON.stringify(event);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/v1/ai/milestone-feedback", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "生成里程碑反馈失败");
        if (!cancelled) {
          setFeedback(result.text ?? "");
          setModel(result.model ?? null);
        }
      } catch {
        if (!cancelled) setFeedback("完成得不错，继续保持！");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eventKey is the stable serialized dependency; event itself is captured by the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  if (!feedback) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-amber-100">
      <Sparkles className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold leading-6">{feedback}</p>
        {model && model !== "fallback" ? (
          <p className="mt-1 text-xs text-amber-700/70">AI 生成，仅供参考</p>
        ) : null}
      </div>
    </div>
  );
}
