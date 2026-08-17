"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Circle, Eye, EyeOff, Map, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { KnowledgeMapNode, KnowledgeMapStatus, PublicKnowledgeMap } from "@/lib/domain/knowledge-map";
import { cn } from "@/lib/utils";

const STATUS_META: Record<KnowledgeMapStatus, { label: string; className: string; icon: typeof Circle }> = {
  mastered: { label: "已点亮", className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200", icon: CheckCircle2 },
  weak: { label: "待攻克", className: "border-amber-300/20 bg-amber-400/10 text-amber-200", icon: AlertTriangle },
  unvisited: { label: "未探索", className: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]", icon: Circle },
};

export function KnowledgeMapView({ initial }: { initial: PublicKnowledgeMap }) {
  const [map, setMap] = useState(initial);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleMapEntry() {
    setPending(true);
    setMessage(null);
    const next = !map.mapEnabled;
    try {
      const response = await fetch("/api/v1/rpg/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapEnabled: next }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: result.message ?? "更新学习地图入口设置失败" });
        return;
      }
      setMap((current) => ({ ...current, mapEnabled: result.mapEnabled }));
      setMessage({ tone: "success", text: result.mapEnabled ? "学习地图入口已显示在首页" : "学习地图入口已从首页隐藏" });
    } catch {
      setMessage({ tone: "error", text: "连接失败，请稍后重试" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="safe-bottom">
      <div className="receiver-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.22em] text-[var(--primary)]">Knowledge Map</div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">知识点地图</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
              按知识点树查看掌握状态。已点亮节点代表已掌握，待攻克节点可以进入专项练习副本。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="green">{map.stats.mastered} 已点亮</Badge>
              <Badge tone="amber">{map.stats.weak} 待攻克</Badge>
              <Badge tone="neutral">{map.stats.unvisited} 未探索</Badge>
              <span className="text-[var(--muted-foreground)]">共 {map.stats.total} 个知识点</span>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={toggleMapEntry}>
            {map.mapEnabled ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            {pending ? "处理中" : map.mapEnabled ? "隐藏首页入口" : "在首页显示入口"}
          </Button>
        </div>
      </div>

      {message ? (
        <div role="alert" className={cn("mt-4 rounded-xl border px-4 py-3 text-sm font-semibold", message.tone === "error" ? "border-rose-300/20 bg-rose-400/10 text-rose-200" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200")}>
          {message.text}
        </div>
      ) : null}

      <Card className="mt-6">
        <CardContent>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Map className="size-4 text-[var(--primary)]" />
              技能树 / 副本入口
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-300" />已点亮</span>
              <span className="flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-amber-300" />待攻克</span>
              <span className="flex items-center gap-1.5"><Circle className="size-3.5" />未探索</span>
            </div>
          </div>
          {map.nodes.length === 0 ? (
            <div className="rounded-2xl bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              教师尚未配置知识点树，地图暂时为空。
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {map.nodes.map((node) => <MapNode key={node.id} node={node} depth={0} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MapNode({ node, depth }: { node: KnowledgeMapNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const meta = STATUS_META[node.status];
  const StatusIcon = meta.icon;

  return (
    <div>
      <div className={cn("flex items-center gap-3 rounded-2xl border bg-[var(--surface-soft)] p-3 transition hover:bg-[var(--muted)]", meta.className)}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={!hasChildren}
          aria-label={hasChildren ? (open ? "收起下级" : "展开下级") : undefined}
          className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] disabled:opacity-40"
        >
          {hasChildren ? (open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />) : <span className="size-4" />}
        </button>
        <div className="grid size-9 place-items-center rounded-xl bg-black/10">
          <StatusIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-radio text-xs font-bold text-[var(--muted-foreground)]">{node.code}</span>
            <span className="truncate text-sm font-extrabold">{node.name}</span>
            <Badge tone={node.status === "mastered" ? "green" : node.status === "weak" ? "amber" : "neutral"}>{meta.label}</Badge>
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {node.answered > 0 ? `已答 ${node.answered} · 正确率 ${node.accuracy}%` : "尚未练习"}
            {node.hasPractice ? " · 可进入副本" : ""}
          </div>
        </div>
        {node.status === "weak" && node.practiceHref ? (
          <Link
            href={node.practiceHref as never}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 text-xs font-bold text-amber-100 transition hover:bg-amber-400/20"
          >
            <Swords className="size-3.5" />
            进入副本
          </Link>
        ) : null}
      </div>
      {open && hasChildren ? (
        <div className="ml-6 mt-2 flex flex-col gap-2 border-l border-[var(--border)] pl-4">
          {node.children.map((child) => <MapNode key={child.id} node={child} depth={depth + 1} />)}
        </div>
      ) : null}
    </div>
  );
}
