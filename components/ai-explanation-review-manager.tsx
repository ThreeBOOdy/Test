"use client";

import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type ExplanationReviewRow = {
  id: string;
  externalQuestionCode: string | null;
  stem: string;
  type: string;
  explanationStatus: string;
  explanationVersion: number;
  explanationRejectReason: string | null;
  explanation: { summary: string; knowledge: string; memory: string } | null;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  level: { id: string; code: string; name: string };
  knowledgePoint: { id: string; code: string; name: string };
};

type ExplanationReviewDetail = ExplanationReviewRow & {
  sourceBankCode: string | null;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  selectionSpec: string;
  version: number;
  reviewedById: string | null;
};

const STATUS_META: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" }> = {
  NONE: { label: "未生成", tone: "neutral" },
  DRAFT: { label: "待审核", tone: "amber" },
  APPROVED: { label: "已通过", tone: "green" },
  REJECTED: { label: "已驳回", tone: "red" },
};

export function AiExplanationReviewManager({ rows }: { rows: ExplanationReviewRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ExplanationReviewRow | null>(null);
  const [detail, setDetail] = useState<ExplanationReviewDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [memory, setMemory] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function openReview(row: ExplanationReviewRow) {
    setMessage("");
    setSelected(row);
    setDetail(null);
    const response = await authenticatedFetch(`/api/v1/teacher/ai-explanations/${row.id}`);
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "读取解析详情失败");
      return;
    }
    setDetail(result);
    setSummary(result.explanation?.summary ?? "");
    setKnowledge(result.explanation?.knowledge ?? "");
    setMemory(result.explanation?.memory ?? "");
    setRejectReason(result.explanationRejectReason ?? "");
  }

  async function submitReview(action: "APPROVE" | "APPROVE_WITH_EDITS" | "REJECT") {
    if (!selected || !detail) return;
    setPending(true);
    setMessage("");
    const body: Record<string, unknown> = { action, version: detail.version };
    if (action === "APPROVE_WITH_EDITS") {
      body.content = { summary, knowledge, memory };
    } else if (action === "REJECT") {
      body.rejectReason = rejectReason;
    }
    const response = await authenticatedFetch(`/api/v1/teacher/ai-explanations/${selected.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "提交审核失败");
      return;
    }
    setSelected(null);
    setDetail(null);
    router.refresh();
  }

  const editable = detail && (detail.explanationStatus === "DRAFT" || detail.explanationStatus === "REJECTED");

  return <>
    <Card className="overflow-hidden"><CardContent className="overflow-x-auto p-0"><table className="responsive-data-table min-w-[980px] w-full border-collapse text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--muted)] text-xs text-[var(--muted-foreground)]"><Th>题目编号</Th><Th>题干</Th><Th>等级</Th><Th>知识点</Th><Th>解析状态</Th><Th>更新时间</Th><Th>操作</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/60"><Td label="题目编号"><div className="font-semibold">{row.externalQuestionCode || "-"}</div></Td><Td label="题干"><div className="max-w-md font-semibold md:truncate" title={row.stem}>{row.stem}</div></Td><Td label="等级"><Badge tone="green">{row.level.code}级</Badge></Td><Td label="知识点"><div className="text-sm font-semibold">{row.knowledgePoint.code}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{row.knowledgePoint.name}</div></Td><Td label="解析状态"><StatusBadge status={row.explanationStatus} /></Td><Td label="更新时间"><div className="text-xs text-[var(--muted-foreground)]">{new Date(row.updatedAt).toLocaleString()}</div></Td><Td label="操作" actions><Button variant="outline" size="sm" onClick={() => openReview(row)}><Check className="size-4" />审核</Button></Td></tr>)}</tbody></table>{rows.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">没有符合条件的 AI 解析</div> : null}</CardContent></Card>

    {selected ? <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="AI 解析审核"><div className="my-auto w-full max-w-4xl rounded-[24px] bg-[var(--surface-soft)] p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-extrabold">AI 解析审核</h2><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="关闭"><X className="size-5" /></Button></div>
      {!detail ? <div className="flex items-center justify-center gap-3 py-12 text-sm text-[var(--muted-foreground)]"><Loader2 className="size-5 animate-spin" />加载解析详情…</div> : <>
        {message ? <div className="mb-4 rounded-xl bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">{message}</div> : null}
        <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:grid-cols-2">
          <Info label="题目编号" value={detail.externalQuestionCode || "-"} />
          <Info label="等级 / 知识点" value={`${detail.level.code}级 · ${detail.knowledgePoint.code} ${detail.knowledgePoint.name}`} />
          <Info label="题型 / 规格" value={`${detail.type === "SINGLE_CHOICE" ? "单选" : "多选"} · ${detail.selectionSpec}`} />
          <Info label="审核人" value={detail.reviewedByName ?? "尚未审核"} />
        </div>
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="mb-3 text-sm font-bold">题干</div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{detail.stem}</div>
          <div className="mt-4 grid gap-2">
            {detail.options.map((option) => <div key={option.id} className={`rounded-xl border px-3 py-2 text-sm ${detail.correctOptionIds.includes(option.id) ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-[var(--border)] bg-[var(--surface-soft)]"}`}>{option.id}. {option.text}{detail.correctOptionIds.includes(option.id) ? " ✓" : ""}</div>)}
          </div>
        </div>
        <div className="grid gap-4">
          <Field label="一句话解析"><textarea value={summary} onChange={(event) => setSummary(event.target.value)} disabled={!editable} className={inputClass} rows={3} /></Field>
          <Field label="知识点讲解"><textarea value={knowledge} onChange={(event) => setKnowledge(event.target.value)} disabled={!editable} className={inputClass} rows={5} /></Field>
          <Field label="记忆点"><textarea value={memory} onChange={(event) => setMemory(event.target.value)} disabled={!editable} className={inputClass} rows={2} /></Field>
          <Field label="驳回原因"><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} disabled={!editable} className={inputClass} rows={2} placeholder="驳回时填写原因（可选）" /></Field>
        </div>
        {editable ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" disabled={pending} onClick={() => submitReview("REJECT")}><RotateCcw className="size-4" />驳回</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => submitReview("APPROVE")}><Check className="size-4" />直接通过</Button>
          <Button type="button" disabled={pending} onClick={() => submitReview("APPROVE_WITH_EDITS")}><Check className="size-4" />修改后通过</Button>
        </div> : <div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">{detail.explanationStatus === "NONE" ? "该题还没有 AI 解析草稿" : "该解析已审核，不能重复提交"}</div>}
      </>}
    </div></div> : null}
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>;
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-4 font-semibold">{children}</th>;
}

function Td({ label, actions = false, children }: { label: string; actions?: boolean; children: React.ReactNode }) {
  return <td data-label={label} data-actions={actions || undefined} className="px-5 py-4 text-sm">{children}</td>;
}

const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20 disabled:opacity-60";
