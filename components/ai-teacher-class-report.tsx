"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";

type TeacherClassReport = {
  generatedAt: string;
  period: { start: string; end: string; label: string };
  summary: { completedSessions: number; activeStudents: number; answered: number; correct: number; accuracy: number };
  weakPoints: Array<{ code: string; name: string; answered: number; correct: number; accuracy: number }>;
  content: { overview: string; weakPoints: string[]; classFocus: string[]; suggestions: string };
  disclaimer: string;
  model: string;
};

export function AiTeacherClassReport() {
  const [report, setReport] = useState<TeacherClassReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch("/api/v1/teacher/reports/ai")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "生成班级报告失败");
        if (!cancelled) setReport(data as TeacherClassReport);
      })
      .catch((error) => {
        if (!cancelled) {
          setReport(null);
          setMessage(error instanceof Error ? error.message : "生成班级报告失败，请稍后重试");
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
              <Sparkles className="size-3.5" />AI CLASS SIGNAL
            </div>
            <CardTitle className="mt-2 flex items-center gap-2">AI 班级学情报告</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="blue">AI 生成</Badge>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={refresh} aria-label="重新生成班级报告">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-5 animate-spin" />正在生成班级 AI 学情报告…
          </div>
        ) : message ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <UsersRound className="size-8 text-[var(--muted-foreground)]" />
            <div className="text-sm text-[var(--muted-foreground)]">{message}</div>
            <Button type="button" variant="outline" size="sm" onClick={refresh}>重试</Button>
          </div>
        ) : report ? (
          <div className="space-y-5">
            <p className="text-sm leading-7 text-[var(--foreground)]">{report.content.overview}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="全班薄弱知识点" items={report.content.weakPoints} empty="暂无明显班级薄弱点。" />
              <Section title="建议课堂重点" items={report.content.classFocus} empty="暂无重点建议。" />
            </div>
            {report.content.suggestions ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                {report.content.suggestions}
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
