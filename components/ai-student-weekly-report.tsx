"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";

type StudentWeeklyReport = {
  generatedAt: string;
  period: { start: string; end: string; label: string };
  summary: { completedSessions: number; answered: number; correct: number; accuracy: number; totalMinutes: number };
  weakPoints: Array<{ code: string; name: string; answered: number; correct: number; accuracy: number }>;
  content: { summary: string; weakPoints: string[]; nextSteps: string[]; encouragement: string };
  disclaimer: string;
  model: string;
};

export function AiStudentWeeklyReport() {
  const [report, setReport] = useState<StudentWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch("/api/v1/student/reports/weekly")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "生成周报失败");
        if (!cancelled) setReport(data as StudentWeeklyReport);
      })
      .catch((error) => {
        if (!cancelled) {
          setReport(null);
          setMessage(error instanceof Error ? error.message : "生成周报失败，请稍后重试");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refresh() {
    setLoading(true);
    setMessage("");
    setRefreshKey((key) => key + 1);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-[var(--primary)]">
              <Sparkles className="size-3.5" />AI WEEKLY SIGNAL
            </div>
            <CardTitle className="mt-2 flex items-center gap-2">AI 本周学情报告</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="blue">AI 生成</Badge>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={refresh} aria-label="重新生成周报">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-5 animate-spin" />正在生成本周 AI 学情报告…
          </div>
        ) : message ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Brain className="size-8 text-[var(--muted-foreground)]" />
            <div className="text-sm text-[var(--muted-foreground)]">{message}</div>
            <Button type="button" variant="outline" size="sm" onClick={refresh}>重试</Button>
          </div>
        ) : report ? (
          <div className="space-y-5">
            <p className="text-sm leading-7 text-[var(--foreground)]">{report.content.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="本周薄弱点" items={report.content.weakPoints} empty="本周没有明显薄弱点，继续保持。" />
              <Section title="下一步建议" items={report.content.nextSteps} empty="暂无建议，先保持当前节奏。" />
            </div>
            {report.content.encouragement ? (
              <div className="rounded-2xl border border-cyan-600/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-800">
                {report.content.encouragement}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)]">
              <span>{report.disclaimer}</span>
              <span>模型：{report.model}</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-extrabold">{title}</div>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2 rounded-xl bg-[var(--muted)] px-3 py-2 text-sm leading-6">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]">{empty}</div>
      )}
    </div>
  );
}
