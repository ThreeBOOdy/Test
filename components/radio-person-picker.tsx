"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type RadioPersonOption = { id: string; username: string; name: string; profile: string };

const PAGE_SIZE = 4;

function shuffleOptions(items: RadioPersonOption[]): RadioPersonOption[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function RadioPersonPicker({ people, value, onChange, disabled = false }: {
  people: RadioPersonOption[];
  value: string;
  onChange: (personId: string) => void;
  disabled?: boolean;
}) {
  const [page, setPage] = useState(0);

  // 人物列表更新（例如 409 冲突后重新拉取）时，重新随机排序并回到第一页。
  const [lastPeople, setLastPeople] = useState(people);
  if (lastPeople !== people) {
    setLastPeople(people);
    setPage(0);
  }
  const ordered = useMemo(() => shuffleOptions(people), [people]);

  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = ordered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (!ordered.length) {
    return <div role="status" className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">暂无可选人物身份，请联系管理员维护目录。</div>;
  }

  return <div className="space-y-4">
    <div className="grid gap-3">
      {visible.map((person) => <label key={person.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${value === person.id ? "border-[var(--primary)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}><input type="radio" name="radioPersonId" value={person.id} checked={value === person.id} onChange={() => onChange(person.id)} className="mt-1" disabled={disabled} required /><span className="min-w-0"><span className="block font-extrabold">{person.name}</span><span className="mt-1 block font-mono text-sm text-[var(--primary)]">{person.username}</span><span className="mt-2 block text-sm text-[var(--muted-foreground)]">{person.profile}</span></span></label>)}
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[var(--muted-foreground)]">共 {ordered.length} 位 · 第 {safePage + 1} / {pageCount} 页</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || safePage === 0} onClick={() => setPage(safePage - 1)}>上一页</Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>下一页</Button>
      </div>
    </div>
  </div>;
}
