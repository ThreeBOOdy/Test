"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WrongClearButton } from "@/components/wrong-clear-button";

type LevelOption = { id: string; code: string; name: string; enabled: boolean };
type StudentRow = {
  id: string;
  username: string;
  realName: string;
  school: string | null;
  grade: { name: string } | null;
  studentStatus: string | null;
  enabled: boolean;
  activeLevel: { id: string; code: string; name: string } | null;
};
type TeacherStudentPage = {
  items: StudentRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  levels: LevelOption[];
};

export function TeacherStudentManager({ initial }: { initial: TeacherStudentPage }) {
  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageSize, setPageSize] = useState(initial.pagination.pageSize);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadStudents(page = 1, nextSearch = search, nextStatus = status, nextPageSize = pageSize) {
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(nextPageSize) });
      if (nextSearch.trim()) query.set("search", nextSearch.trim());
      if (nextStatus) query.set("status", nextStatus);
      const response = await fetch(`/api/v1/teacher/students?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "读取学生列表失败");
        return false;
      }
      setResult((current) => ({ ...data, levels: current.levels }));
      setPageSize(data.pagination.pageSize);
      setDrafts({});
      return true;
    } catch {
      setMessage("读取学生列表失败，请稍后重试");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function saveActiveLevel(row: StudentRow) {
    const selectedLevelId = drafts[row.id] ?? row.activeLevel?.id ?? "";
    setSavingId(row.id);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/teacher/students/${row.id}/active-level`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeLevelId: selectedLevelId || null }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "设置字母类失败");
        return;
      }
      const activeLevel = selectedLevelId
        ? (result.levels.find((level) => level.id === selectedLevelId) ?? null)
        : null;
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => item.id === row.id ? { ...item, activeLevel } : item),
      }));
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setMessage("字母类已保存");
    } catch {
      setMessage("设置字母类失败，请稍后重试");
    } finally {
      setSavingId(null);
    }
  }

  const enabledLevels = result.levels.filter((level) => level.enabled);

  return <>
    <Card><CardContent className="pt-6"><div className="grid gap-3 md:grid-cols-4">
      <input aria-label="搜索学生" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="姓名、人物用户名或学校" className={inputClass} />
      <select aria-label="学生状态筛选" value={status} onChange={(event) => { const nextStatus = event.target.value; setStatus(nextStatus); void loadStudents(1, search, nextStatus, pageSize); }} className={inputClass}>
        <option value="">全部状态</option>
        <option value="PENDING">待审核</option>
        <option value="ACTIVE">正常</option>
        <option value="REJECTED">已拒绝</option>
      </select>
      <select aria-label="每页显示条数" value={pageSize} onChange={(event) => { const nextPageSize = Number(event.target.value); setPageSize(nextPageSize); void loadStudents(1, search, status, nextPageSize); }} className={inputClass}>
        <option value={20}>每页 20 条</option>
        <option value={50}>每页 50 条</option>
        <option value={100}>每页 100 条</option>
      </select>
      <Button onClick={() => void loadStudents(1)} disabled={loading}>{loading ? "正在搜索…" : "搜索"}</Button>
    </div>{message ? <p role="status" className="mt-4 text-sm text-[var(--muted-foreground)]">{message}</p> : null}</CardContent></Card>

    <Card className="mt-5"><CardContent className="overflow-auto">
      <table className="responsive-data-table min-w-[1000px] w-full text-left text-sm">
        <thead><tr>{["学生姓名", "人物用户名", "学校/年级", "账号状态", "当前字母类", "设置字母类", "操作"].map((item) => <th key={item} className="px-3 py-3 text-xs">{item}</th>)}</tr></thead>
        <tbody>
          {result.items.map((row) => {
            const currentLevelId = row.activeLevel?.id ?? "";
            const selected = drafts[row.id] ?? currentLevelId;
            const dirty = selected !== currentLevelId;
            const options = [...enabledLevels];
            if (row.activeLevel && !enabledLevels.some((level) => level.id === row.activeLevel!.id)) {
              options.push({ ...row.activeLevel, enabled: false });
            }
            return <tr key={row.id} className="border-t border-[var(--border)]">
              <StudentCell label="学生姓名">{row.realName}</StudentCell>
              <StudentCell label="人物用户名">{row.username}</StudentCell>
              <StudentCell label="学校/年级">{row.school ?? "—"}{row.grade ? ` · ${row.grade.name}` : ""}</StudentCell>
              <StudentCell label="账号状态">{studentStatusLabel(row.studentStatus, row.enabled)}</StudentCell>
              <StudentCell label="当前字母类">{row.activeLevel ? <span className="font-bold">{row.activeLevel.code}级</span> : "未分配"}</StudentCell>
              <StudentCell label="设置字母类">
                <select aria-label={`设置 ${row.realName} 的字母类`} value={selected} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))} className={inputClass}>
                  <option value="">未分配</option>
                  {options.map((level) => <option key={level.id} value={level.id} disabled={!level.enabled}>{level.code}级{level.enabled ? "" : "（停用）"}</option>)}
                </select>
              </StudentCell>
              <StudentCell label="操作" actions>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void saveActiveLevel(row)} disabled={savingId === row.id || !dirty}>{savingId === row.id ? "正在保存…" : "保存"}</Button>
                  {row.activeLevel ? <WrongClearButton apiPath={`/api/v1/teacher/students/${row.id}/wrong/clear`} buttonLabel="清除错题" successMessage="错题已清除" /> : null}
                </div>
              </StudentCell>
            </tr>;
          })}
        </tbody>
      </table>
      {!result.items.length ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">没有符合条件的学生账号。</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm">
        <span>共 {result.pagination.total} 条，第 {result.pagination.page}/{result.pagination.totalPages} 页</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading || result.pagination.page <= 1} onClick={() => void loadStudents(result.pagination.page - 1)}>上一页</Button>
          <Button size="sm" variant="outline" disabled={loading || result.pagination.page >= result.pagination.totalPages} onClick={() => void loadStudents(result.pagination.page + 1)}>下一页</Button>
        </div>
      </div>
    </CardContent></Card>
  </>;
}

function studentStatusLabel(status: string | null, enabled: boolean) {
  if (!enabled) return "已停用";
  return status === "PENDING" ? "待审核" : status === "ACTIVE" ? "正常" : status === "REJECTED" ? "已拒绝" : "—";
}

function StudentCell({ label, actions = false, children }: { label: string; actions?: boolean; children: React.ReactNode }) {
  return <td data-label={label} className={`px-3 py-3 ${actions ? "min-w-24" : ""}`}>{children}</td>;
}

const inputClass = "h-12 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 outline-none focus:border-[var(--border-strong)]";
