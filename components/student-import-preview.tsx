"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deriveGenderFromNationalId } from "@/lib/domain/student-identity";

type ImportRow = {
  id: string;
  sheetName: string;
  sourceRowNumber: number;
  payload: Record<string, unknown>;
  issues: { message: string }[];
  valid: boolean;
};

type Batch = {
  id: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ImportRow[];
};

type EditDraft = {
  username: string;
  displayName: string;
  nationalId: string;
  school: string;
  grade: string;
  phone: string;
  initialPassword: string;
  enabled: boolean;
  validFrom: string;
  validUntil: string;
  isLongTerm: boolean;
};

type EditingRow = {
  row: ImportRow;
  draft: EditDraft;
};

const inputClassName =
  "mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

function textValue(value: unknown) {
  return String(value ?? "");
}

function booleanValue(value: unknown) {
  return value === true;
}

function createEditDraft(row: ImportRow): EditDraft {
  return {
    username: textValue(row.payload.username),
    displayName: textValue(row.payload.displayName),
    nationalId: textValue(row.payload.nationalId),
    school: textValue(row.payload.school),
    grade: textValue(row.payload.grade),
    phone: textValue(row.payload.phone),
    initialPassword: "",
    enabled: booleanValue(row.payload.enabled),
    validFrom: textValue(row.payload.validFrom),
    validUntil: textValue(row.payload.validUntil),
    isLongTerm: booleanValue(row.payload.isLongTerm),
  };
}

function genderLabel(nationalId: string) {
  const gender = deriveGenderFromNationalId(nationalId);
  if (gender === "MALE") return "男";
  if (gender === "FEMALE") return "女";
  return "无法识别";
}

export function StudentImportPreview() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/v1/admin/student-imports/preview", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (response.ok) {
        setBatch(result);
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("上传失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function validateAll() {
    if (!batch) return;
    const response = await fetch(
      `/api/v1/admin/student-imports/${batch.id}/validate`,
      { method: "POST" },
    );
    const result = await response.json();
    if (response.ok) {
      setBatch(result);
      setMessage("全部行已重新校验");
    } else {
      setMessage(result.message);
    }
  }

  async function commit() {
    if (!batch) return;
    const response = await fetch(
      `/api/v1/admin/student-imports/${batch.id}/commit`,
      { method: "POST" },
    );
    const result = await response.json();
    setMessage(
      response.ok
        ? `成功导入 ${result.count} 个学生账号，账号直接生效。`
        : result.message,
    );
  }

  function openEditor(row: ImportRow) {
    setEditing({ row, draft: createEditDraft(row) });
    setMessage("");
  }

  function updateDraft<K extends keyof EditDraft>(key: K, value: EditDraft[K]) {
    setEditing((current) =>
      current
        ? { ...current, draft: { ...current.draft, [key]: value } }
        : current,
    );
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch || !editing) return;

    setPending(true);
    try {
      const response = await fetch(
        `/api/v1/admin/student-imports/${batch.id}/rows/${editing.row.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editing.row.payload,
            ...editing.draft,
          }),
        },
      );
      const result = await response.json();
      if (response.ok) {
        setBatch(result);
        setEditing(null);
        setMessage("导入行已保存并重新校验");
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("保存失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          <label className="block text-sm font-bold">
            选择学生账号 Excel
            <input
              aria-label="学生账号 Excel"
              type="file"
              accept=".xlsx"
              onChange={upload}
              className="mt-3 block w-full"
            />
          </label>
          {pending ? <p className="mt-3">正在处理…</p> : null}
        </CardContent>
      </Card>

      {batch ? (
        <Card className="mt-5">
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <strong>总计 {batch.totalRows}</strong>
              <span className="text-emerald-400">通过 {batch.validRows}</span>
              <span className="text-rose-400">错误 {batch.errorRows}</span>
              <Button variant="outline" onClick={validateAll} disabled={pending}>
                全部重新校验
              </Button>
              <Button onClick={commit} disabled={pending || batch.errorRows > 0}>
                确认导入
              </Button>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr>
                    {["来源", "用户名", "姓名", "学校", "年级", "性别", "启用", "有效期", "长期", "结果", "编辑"].map(
                      (heading) => (
                        <th key={heading} className="px-3 py-3">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-3">{row.sheetName}!{row.sourceRowNumber}</td>
                      <td className="px-3 py-3">{textValue(row.payload.username)}</td>
                      <td className="px-3 py-3">{textValue(row.payload.displayName)}</td>
                      <td className="px-3 py-3">{textValue(row.payload.school)}</td>
                      <td className="px-3 py-3">{textValue(row.payload.grade)}</td>
                      <td className="px-3 py-3">{row.payload.gender === "MALE" ? "男" : "女"}</td>
                      <td className="px-3 py-3">{row.payload.enabled ? "是" : "否"}</td>
                      <td className="px-3 py-3">{textValue(row.payload.validFrom)} 至 {textValue(row.payload.validUntil)}</td>
                      <td className="px-3 py-3">{row.payload.isLongTerm ? "是" : "否"}</td>
                      <td className="px-3 py-3">{row.valid ? "通过" : row.issues.map((issue) => issue.message).join("；")}</td>
                      <td className="px-3 py-3">
                        <Button size="sm" variant="outline" onClick={() => openEditor(row)}>
                          编辑
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-import-edit-title"
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="student-import-edit-title" className="text-xl font-bold">编辑导入学生</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{editing.row.sheetName}!{editing.row.sourceRowNumber}</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>关闭</Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">用户名<input aria-label="用户名" value={editing.draft.username} onChange={(event) => updateDraft("username", event.target.value)} className={inputClassName} /></label>
              <label className="text-sm font-semibold">姓名<input aria-label="姓名" value={editing.draft.displayName} onChange={(event) => updateDraft("displayName", event.target.value)} className={inputClassName} /></label>
              <label className="text-sm font-semibold md:col-span-2">身份证号<input aria-label="身份证号" value={editing.draft.nationalId} onChange={(event) => updateDraft("nationalId", event.target.value)} className={inputClassName} /></label>
              <p className="text-sm text-[var(--muted-foreground)] md:col-span-2">性别由身份证号自动推导：{genderLabel(editing.draft.nationalId)}</p>
              <label className="text-sm font-semibold">学校<input aria-label="学校" value={editing.draft.school} onChange={(event) => updateDraft("school", event.target.value)} className={inputClassName} /></label>
              <label className="text-sm font-semibold">年级<input aria-label="年级" value={editing.draft.grade} onChange={(event) => updateDraft("grade", event.target.value)} className={inputClassName} /></label>
              <label className="text-sm font-semibold">手机号<input aria-label="手机号" value={editing.draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} className={inputClassName} /></label>
              <label className="text-sm font-semibold">初始密码<input aria-label="初始密码" type="password" value={editing.draft.initialPassword} onChange={(event) => updateDraft("initialPassword", event.target.value)} placeholder="留空则保留原密码" className={inputClassName} /></label>
              <label className="text-sm font-semibold">有效期开始<input aria-label="有效期开始" type="date" value={editing.draft.validFrom} onChange={(event) => updateDraft("validFrom", event.target.value)} className={inputClassName} /></label>
              <label className="text-sm font-semibold">有效期结束<input aria-label="有效期结束" type="date" value={editing.draft.validUntil} onChange={(event) => updateDraft("validUntil", event.target.value)} className={inputClassName} /></label>
            </div>

            <div className="mt-5 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold"><input aria-label="启用账号" type="checkbox" checked={editing.draft.enabled} onChange={(event) => updateDraft("enabled", event.target.checked)} />启用账号</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input aria-label="长期账号" type="checkbox" checked={editing.draft.isLongTerm} onChange={(event) => updateDraft("isLongTerm", event.target.checked)} />长期账号</label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button type="submit" disabled={pending}>保存并校验</Button>
            </div>
          </form>
        </div>
      ) : null}

      {message ? <div role="status" className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3">{message}</div> : null}
    </>
  );
}
