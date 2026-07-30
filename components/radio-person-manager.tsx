"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Person = { id: string; username: string; name: string; profile: string; resourceStatus: "AVAILABLE" | "UNAVAILABLE"; statusNote: string | null; student: { id: string; username: string; realName: string | null; displayName: string } | null };
type PersonForm = { id: string; username: string; name: string; profile: string; resourceStatus: "AVAILABLE" | "UNAVAILABLE"; statusNote: string };
const blank: PersonForm = { id: "", username: "", name: "", profile: "", resourceStatus: "AVAILABLE", statusNote: "" };

export function RadioPersonManager({ initialPeople }: { initialPeople: Person[] }) {
  const [people, setPeople] = useState(initialPeople);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PersonForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => people.filter((person) => `${person.id} ${person.username} ${person.name} ${person.profile}`.toLowerCase().includes(search.toLowerCase())), [people, search]);
  const selected = editingId ? people.find((person) => person.id === editingId) ?? null : null;
  const bound = Boolean(selected?.student);

  function update<K extends keyof PersonForm>(key: K, value: PersonForm[K]) { setForm((current) => current ? { ...current, [key]: value } : current); }
  function create() { setMessage(""); setEditingId(null); setForm(blank); }
  function edit(person: Person) { setMessage(""); setEditingId(person.id); setForm({ id: person.id, username: person.username, name: person.name, profile: person.profile, resourceStatus: person.resourceStatus, statusNote: person.statusNote ?? "" }); }
  function cancel() { setEditingId(null); setForm(null); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true); setMessage("");
    const payload = { username: form.username, name: form.name, profile: form.profile, resourceStatus: form.resourceStatus, statusNote: form.statusNote || null };
    const response = await fetch(editingId ? `/api/v1/admin/radio-people/${editingId}` : "/api/v1/admin/radio-people", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? payload : { id: form.id, ...payload }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(result.message ?? "保存人物身份失败");
    if (editingId) setPeople((current) => current.map((person) => person.id === editingId ? { ...person, ...result } : person));
    else setPeople((current) => [...current, { ...result, student: null }].sort((left, right) => left.name.localeCompare(right.name, "zh-CN")));
    cancel(); setMessage("人物身份已保存");
  }

  return <><div className="flex flex-wrap gap-3"><input aria-label="搜索人物身份" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="稳定 ID、用户名、名称或资料" /><Button onClick={create}>新增人物</Button></div>{message ? <div role="status" className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3 text-sm">{message}</div> : null}{form ? <Card className="mt-5"><CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-2"><Field label="稳定 ID"><input aria-label="稳定 ID" value={form.id} onChange={(event) => update("id", event.target.value)} className={inputClass} disabled={Boolean(editingId)} required /></Field><Field label="人物用户名"><input aria-label="人物用户名" value={form.username} onChange={(event) => update("username", event.target.value)} className={inputClass} disabled={bound} required /></Field><Field label="人物名称"><input aria-label="人物名称" value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} disabled={bound} required /></Field><Field label="资源状态"><select aria-label="资源状态" value={form.resourceStatus} onChange={(event) => update("resourceStatus", event.target.value as PersonForm["resourceStatus"])} className={inputClass}><option value="AVAILABLE">可选</option><option value="UNAVAILABLE">不可选</option></select></Field><div className="md:col-span-2"><Field label="人物资料"><textarea aria-label="人物资料" value={form.profile} onChange={(event) => update("profile", event.target.value)} className={textareaClass} disabled={bound} required /></Field></div><div className="md:col-span-2"><Field label="状态说明"><input aria-label="状态说明" value={form.statusNote} onChange={(event) => update("statusNote", event.target.value)} className={inputClass} /></Field></div>{bound ? <p className="md:col-span-2 text-sm text-[var(--muted-foreground)]">该身份已绑定给 {selected?.student?.realName ?? selected?.student?.displayName}（{selected?.student?.username}）；仅可修改资源状态和状态说明。</p> : null}<div className="md:col-span-2 flex justify-end gap-3"><Button type="button" variant="outline" onClick={cancel} disabled={saving}>取消</Button><Button type="submit" disabled={saving}>{saving ? "正在保存…" : "保存人物身份"}</Button></div></form></CardContent></Card> : null}<Card className="mt-5"><CardContent className="overflow-auto"><table className="min-w-[1000px] w-full text-left text-sm"><thead><tr>{["稳定 ID", "人物用户名", "名称", "状态", "绑定学生", "说明", "操作"].map((label) => <th key={label} className="px-3 py-3 text-xs">{label}</th>)}</tr></thead><tbody>{filtered.map((person) => <tr key={person.id} className="border-t border-[var(--border)]"><td className="px-3 py-3 font-mono text-xs">{person.id}</td><td className="px-3 py-3 font-mono">{person.username}</td><td className="px-3 py-3">{person.name}</td><td className="px-3 py-3">{person.resourceStatus === "AVAILABLE" ? "可选" : "不可选"}</td><td className="px-3 py-3">{person.student ? `${person.student.realName ?? person.student.displayName} · ${person.student.username}` : "未绑定"}</td><td className="px-3 py-3">{person.statusNote ?? "—"}</td><td className="px-3 py-3"><Button size="sm" onClick={() => edit(person)}>维护</Button></td></tr>)}</tbody></table></CardContent></Card></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-extrabold">{label}</span>{children}</label>; }
const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none focus:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60";
const textareaClass = "min-h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 outline-none focus:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60";