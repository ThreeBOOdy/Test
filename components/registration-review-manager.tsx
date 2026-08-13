"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ReviewStatus = "PENDING" | "ACTIVE" | "REJECTED";
type Row = { id: string; username: string; realName: string; school: string | null; grade: { name: string } | null; nationalIdMasked: string | null; phoneMasked: string | null; studentStatus: ReviewStatus | null };
type ReviewResponse = { items: Row[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

const pageSize = 20;

export function RegistrationReviewManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ReviewResponse["pagination"]>({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status });
    if (search) params.set("search", search);
    try {
      const response = await fetch("/api/v1/admin/registrations?" + params);
      const result = await response.json();
      if (requestSequence.current !== requestId) return;
      if (!response.ok) {
        setMessage(result.message ?? "读取注册审核列表失败");
        return;
      }
      const data = result as ReviewResponse;
      setRows(data.items);
      setPagination(data.pagination);
      setSelected([]);
      if (data.pagination.page !== page) setPage(data.pagination.page);
    } catch {
      if (requestSequence.current === requestId) setMessage("读取注册审核列表失败");
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);


  function applySearch() {
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeStatus(nextStatus: ReviewStatus) {
    setLoading(true);
    setPage(1);
    setStatus(nextStatus);
  }

  async function action(id: string, kind: "approve" | "reject") {
    const reason = kind === "reject" ? window.prompt("请输入拒绝原因") : null;
    if (kind === "reject" && !reason) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/admin/registrations/" + id + "/" + kind, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "reject" ? { reason } : {}) });
      const result = await response.json();
      if (!response.ok) setMessage(result.message ?? "审核失败");
      else await load();
    } catch {
      setMessage("审核失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function bulk() {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/admin/registrations/bulk-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected }) });
      const result = await response.json();
      if (!response.ok) setMessage(result.message ?? "批量审核失败");
      else await load();
    } catch {
      setMessage("批量审核失败");
    } finally {
      setSubmitting(false);
    }
  }

  const selectable = status === "PENDING";
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selected.includes(row.id));

  return <><div className="flex flex-wrap gap-3"><input aria-label="搜索申请" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }} className={inputClass} placeholder="学生姓名、人物用户名或学校" /><Button variant="secondary" onClick={applySearch} disabled={loading || submitting}>搜索</Button><label className="sr-only" htmlFor="registration-status">审核状态</label><select id="registration-status" aria-label="审核状态" value={status} onChange={(event) => changeStatus(event.target.value as ReviewStatus)} className={selectClass} disabled={loading || submitting}><option value="PENDING">待审核</option><option value="ACTIVE">已通过</option><option value="REJECTED">已拒绝</option></select><Button onClick={bulk} disabled={!selected.length || submitting || !selectable}>{submitting ? "正在处理…" : "批量通过（" + selected.length + "）"}</Button></div>{message ? <div role="alert" className="mt-4 text-sm text-rose-300">{message}</div> : null}<div className="mt-4 text-sm text-[var(--muted-foreground)]">共 {pagination.total} 项，第 {pagination.page} / {pagination.totalPages} 页</div><Card className="mt-3"><CardContent className="overflow-auto"><table className="min-w-[920px] w-full text-left text-sm"><thead><tr><Th>{selectable ? <input aria-label="选择本页全部申请" type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /> : "状态"}</Th><Th>学生姓名</Th><Th>人物用户名</Th><Th>学校/年级</Th><Th>身份证</Th><Th>手机号</Th><Th>操作</Th></tr></thead><tbody>{loading ? <tr><Td colSpan={7}>正在加载…</Td></tr> : rows.length === 0 ? <tr><Td colSpan={7}>没有符合条件的注册申请</Td></tr> : rows.map((row) => <tr key={row.id} className="border-t border-[var(--border)]"><Td>{selectable ? <input aria-label={"选择 " + row.realName} type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((item) => item !== row.id))} /> : statusLabel(row.studentStatus)}</Td><Td>{row.realName}</Td><Td>{row.username}</Td><Td>{row.school ?? "—"} · {row.grade?.name ?? "—"}</Td><Td>{row.nationalIdMasked ?? "—"}</Td><Td>{row.phoneMasked ?? "—"}</Td><Td>{selectable ? <div className="flex gap-2"><Button size="sm" disabled={submitting} onClick={() => action(row.id, "approve")}>通过</Button><Button size="sm" variant="danger" disabled={submitting} onClick={() => action(row.id, "reject")}>拒绝</Button></div> : "已完成"}</Td></tr>)}</tbody></table></CardContent></Card><div className="mt-4 flex justify-end gap-3"><Button variant="secondary" disabled={loading || submitting || pagination.page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1); }}>上一页</Button><Button variant="secondary" disabled={loading || submitting || pagination.page >= pagination.totalPages} onClick={() => { setLoading(true); setPage((current) => current + 1); }}>下一页</Button></div></>;
}

function statusLabel(status: ReviewStatus | null) { return status === "ACTIVE" ? "已通过" : status === "REJECTED" ? "已拒绝" : "待审核"; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-3 text-xs text-[var(--muted-foreground)]">{children}</th>; }
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) { return <td colSpan={colSpan} className="px-3 py-3">{children}</td>; }
const inputClass = "h-11 min-w-72 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3";
const selectClass = "h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3";
