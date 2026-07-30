"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = { id: string; username: string; realName: string; school: string | null; grade: { name: string } | null; nationalIdMasked: string | null; phoneMasked: string | null };

export function RegistrationReviewManager({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => rows.filter((row) => `${row.username} ${row.realName} ${row.school}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  async function action(id: string, kind: "approve" | "reject") {
    const reason = kind === "reject" ? window.prompt("请输入拒绝原因") : null;
    if (kind === "reject" && !reason) return;
    const response = await fetch(`/api/v1/admin/registrations/${id}/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "reject" ? { reason } : {}) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message);
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function bulk() {
    const response = await fetch("/api/v1/admin/registrations/bulk-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message);
    setRows((current) => current.filter((row) => !selected.includes(row.id)));
    setSelected([]);
  }

  return <><div className="flex flex-wrap gap-3"><input aria-label="搜索申请" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="人物用户名、真实姓名或学校" /><Button onClick={bulk} disabled={!selected.length}>批量通过</Button></div>{message ? <div className="mt-4 text-sm text-rose-300">{message}</div> : null}<Card className="mt-5"><CardContent className="overflow-auto"><table className="min-w-[920px] w-full text-left text-sm"><thead><tr><Th>选择</Th><Th>人物用户名</Th><Th>真实姓名</Th><Th>学校/年级</Th><Th>身份证</Th><Th>手机号</Th><Th>操作</Th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t border-[var(--border)]"><Td><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((item) => item !== row.id))} /></Td><Td>{row.username}</Td><Td>{row.realName}</Td><Td>{row.school} · {row.grade?.name}</Td><Td>{row.nationalIdMasked}</Td><Td>{row.phoneMasked}</Td><Td><div className="flex gap-2"><Button size="sm" onClick={() => action(row.id, "approve")}>通过</Button><Button size="sm" variant="danger" onClick={() => action(row.id, "reject")}>拒绝</Button></div></Td></tr>)}</tbody></table></CardContent></Card></>;
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-3 text-xs text-[var(--muted-foreground)]">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-3 py-3">{children}</td>; }
const inputClass = "h-11 min-w-72 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3";