"use client";

import { useEffect, useState } from "react";
import { Power, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type GradeSetting = {
  id: string;
  code: string;
  name: string;
  studentCount: number;
  gamificationEnabled: boolean;
};

export function GradeGamificationSettings() {
  const [grades, setGrades] = useState<GradeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/v1/teacher/grades", { credentials: "include", cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "读取班级设置失败");
        if (!cancelled) setGrades(result.grades ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取班级设置失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(grade: GradeSetting) {
    setPendingId(grade.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/teacher/grades/${grade.id}/gamification`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !grade.gamificationEnabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "更新班级游戏化设置失败");
      setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, gamificationEnabled: result.gamificationEnabled } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新班级游戏化设置失败");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-sm text-[var(--muted-foreground)]">正在读取班级游戏化设置…</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[var(--primary)]">CLASS GAMIFICATION</div>
            <h2 className="mt-1 text-lg font-extrabold">班级游戏化显示</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">关闭后该年级学生首页不再显示 RPG 面板与学习地图入口，不影响刷题主流程。</p>
          </div>
          <Power className="size-5 text-[var(--primary)]" />
        </div>

        {error ? (
          <div role="alert" className="mt-4 rounded-xl border border-rose-600/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {grades.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)]">暂无年级配置。</div>
          ) : (
            grades.map((grade) => (
              <div key={grade.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/65 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] font-black text-cyan-200 shadow-lg">
                    {grade.code}
                  </div>
                  <div>
                    <div className="font-extrabold">{grade.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <UsersRound className="size-3" />
                      {grade.studentCount} 名学生
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={grade.gamificationEnabled ? "amber" : "neutral"}>
                    {grade.gamificationEnabled ? "显示游戏化" : "隐藏游戏化"}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" disabled={pendingId === grade.id} onClick={() => toggle(grade)}>
                    <Power className="size-3" />
                    {pendingId === grade.id ? "处理中" : grade.gamificationEnabled ? "隐藏" : "显示"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
