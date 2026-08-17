"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AiDailyEncouragement() {
  const [text, setText] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/v1/ai/encouragement", { credentials: "include", cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "获取今日鼓励失败");
        if (!cancelled) {
          setText(result.text ?? "");
          setModel(result.model ?? null);
        }
      } catch {
        if (!cancelled) setText("今天也保持稳定输出，把每个知识点都变成自己的信号。");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!text) return null;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--primary)]">AI 今日鼓励</div>
            <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">{text}</p>
            {model && model !== "fallback" ? (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]/70">AI 生成，仅供参考</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
