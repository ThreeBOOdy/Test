"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Batch = { id: string; fileName: string; status: "PREVIEW" | "COMMITTED" | "REVERTED" | "FAILED"; totalRows: number; insertedRows: number; duplicateRows: number; warningRows: number; errorRows: number; createdAt: string };
type ReportIssue = { severity: "warning" | "error"; field: string; message: string };
type ReportRow = { id: string; rowNumber: number; payload: { rowNumber?: number; sheetName?: string; externalQuestionCode?: string; stem?: string }; issues: ReportIssue[]; valid: boolean };
type Report = { batchId: string; items: ReportRow[]; page: number; total: number; totalPages: number };

export function ImportBatchList({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string>();
  const [reportLoadingId, setReportLoadingId] = useState<string>();
  const [report, setReport] = useState<Report>();
  const [message, setMessage] = useState("");

  async function revert(id: string) {
    if (!window.confirm("确认撤销这个导入批次？该批次的所有题目都会归档，历史记录将继续保留。")) return;
    setPendingId(id);
    setMessage("");
    const response = await fetch(`/api/v1/teacher/import-batches/${id}/revert`, { method: "POST" });
    const data = await response.json();
    setPendingId(undefined);
    if (!response.ok) {
      setMessage(data.message ?? "撤销失败");
      return;
    }
    setMessage(`已归档 ${data.archived} 道题目，未物理删除任何公开题目`);
    router.refresh();
  }

  async function loadReport(batchId: string, page = 1) {
    if (report?.batchId === batchId && report.page === page) {
      setReport(undefined);
      return;
    }
    setReportLoadingId(batchId);
    setMessage("");
    const response = await fetch(`/api/v1/teacher/import-batches/${batchId}?issuesOnly=true&page=${page}&pageSize=20`);
    const data = await response.json();
    setReportLoadingId(undefined);
    if (!response.ok) {
      setMessage(data.message ?? "读取错误报告失败");
      return;
    }
    setReport({ batchId, items: data.items, page: data.page, total: data.total, totalPages: data.totalPages });
  }

  return <Card className="mt-7"><CardHeader><CardTitle>最近导入批次</CardTitle></CardHeader><CardContent><div className="flex flex-col gap-3">{batches.length ? batches.map((batch) => <div key={batch.id} className="rounded-2xl border border-[var(--border)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="truncate font-bold">{batch.fileName}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{new Date(batch.createdAt).toLocaleString("zh-CN")} · 总计 {batch.totalRows} · 导入 {batch.insertedRows} · 重复 {batch.duplicateRows} · 警告 {batch.warningRows} · 错误 {batch.errorRows}</div></div><Badge tone={batch.status === "COMMITTED" ? "green" : batch.status === "REVERTED" ? "amber" : batch.status === "FAILED" ? "red" : "blue"}>{batch.status}</Badge>{batch.warningRows + batch.errorRows > 0 ? <Button variant="outline" size="sm" disabled={reportLoadingId === batch.id} onClick={() => loadReport(batch.id)}><FileWarning className="size-4" />{reportLoadingId === batch.id ? "读取中…" : report?.batchId === batch.id ? "收起报告" : "查看报告"}</Button> : null}{batch.status === "COMMITTED" ? <Button variant="outline" size="sm" disabled={pendingId === batch.id} onClick={() => revert(batch.id)}><RotateCcw className="size-4" />{pendingId === batch.id ? "撤销中…" : "撤销"}</Button> : null}</div>{report?.batchId === batch.id ? <div className="mt-4 border-t border-[var(--border)] pt-4"><div className="mb-3 text-sm font-bold">问题报告（共 {report.total} 行）</div><div className="flex flex-col gap-2">{report.items.map((row) => <div key={row.id} className="rounded-xl bg-[var(--muted)] px-3 py-2 text-sm"><div className="font-semibold">{row.payload.sheetName ? `${row.payload.sheetName}!${row.payload.rowNumber}` : `第 ${row.rowNumber} 行`} · {row.payload.externalQuestionCode || "无题号"} · {row.payload.stem || "无题干"}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{row.issues.map((issue) => `${issue.severity === "error" ? "错误" : "警告"}［${issue.field}］${issue.message}`).join("；")}</div></div>)}</div>{report.totalPages > 1 ? <div className="mt-3 flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={report.page <= 1} onClick={() => loadReport(batch.id, report.page - 1)}>上一页</Button><span className="text-xs text-[var(--muted-foreground)]">{report.page} / {report.totalPages}</span><Button variant="outline" size="sm" disabled={report.page >= report.totalPages} onClick={() => loadReport(batch.id, report.page + 1)}>下一页</Button></div> : null}</div> : null}</div>) : <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无导入批次</div>}</div>{message ? <div className="mt-4 rounded-xl bg-[var(--muted)] px-4 py-3 text-sm font-semibold">{message}</div> : null}</CardContent></Card>;
}
