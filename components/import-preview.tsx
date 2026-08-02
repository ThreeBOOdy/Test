"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, UploadCloud, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LevelChoice = { id: string; code: string; name: string };

type PreviewRow = {
  row: {
    rowNumber: number;
    sheetName?: string;
    locationLabel?: string;
    externalQuestionCode?: string;
    stem: string;
    levelCode: string;
    categoryCode: string;
  };
  selectionSpec: string;
  type: string;
  issues: Array<{ severity: "warning" | "error"; field: string; message: string }>;
};

type Preview = {
  batchId: string;
  fileName: string;
  source: "EXCEL" | "WORD";
  sheetNames: string[];
  stats: { totalRows: number; validRows: number; warningRows: number; errorRows: number };
  rows: PreviewRow[];
};

const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20";

export function ImportPreview({ levels }: { levels: LevelChoice[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState("");
  const [levelCode, setLevelCode] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [knowledgePointName, setKnowledgePointName] = useState("");

  const isWord = file?.name.toLowerCase().endsWith(".docx") ?? false;

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    setFile(next);
    setPreview(undefined);
    setError("");
    setCommitResult("");
    setCategoryCode("");
    setKnowledgePointName("");
    setLevelCode(next?.name.toLowerCase().endsWith(".docx") ? (levels[0]?.code ?? "") : "");
  }

  async function submit() {
    if (!file) return;
    if (isWord && (!levelCode || !categoryCode.trim())) {
      setError("Word 导入需要选择等级并填写分类号");
      return;
    }
    setPending(true);
    setError("");
    setCommitResult("");
    const body = new FormData();
    body.set("file", file);
    if (isWord) {
      body.set("levelCode", levelCode.trim());
      body.set("categoryCode", categoryCode.trim());
      if (knowledgePointName.trim()) body.set("knowledgePointName", knowledgePointName.trim());
    }
    const response = await fetch("/api/v1/teacher/imports/preview", { method: "POST", body });
    const data = await response.json();
    setPending(false);
    if (!response.ok) { setError(data.message ?? "解析失败"); return; }
    setPreview(data);
  }

  async function commit() {
    if (!preview) return;
    setCommitting(true);
    setError("");
    const response = await fetch("/api/v1/teacher/imports/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: preview.batchId }) });
    const data = await response.json();
    setCommitting(false);
    if (!response.ok) { setError(data.message ?? "导入失败"); return; }
    setCommitResult(`成功导入 ${data.inserted} 道题，跳过重复 ${data.skipped} 道`);
    router.refresh();
  }

  return <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]"><Card><CardHeader><CardTitle>上传题库文件</CardTitle><CardDescription>支持 Excel 表格与 Word 题库模板；预检会解析文件内全部内容，并保留来源定位。</CardDescription></CardHeader><CardContent><label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)] p-6 text-center hover:border-emerald-400">{isWord ? <FileText className="size-10 text-[var(--primary)]" /> : <UploadCloud className="size-10 text-[var(--primary)]" />}<div className="mt-4 font-extrabold">选择 .xlsx 或 .docx 文件</div><div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{isWord ? "按小鹅通 Word 批量导入模板解析题号、选项、答案与解析，最多预检 5000 题" : "每个工作表第一行必须是表头，全部工作表合计最多预检 5000 行"}</div><input type="file" accept=".xlsx,.docx" aria-label="选择 .xlsx 或 .docx 文件" className="sr-only" onChange={chooseFile} />{file ? <Badge className="mt-4" tone="green">{file.name}</Badge> : null}</label>{isWord ? <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><div className="mb-3 text-sm font-bold">整份应用表单</div><div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="mb-2 block text-sm font-bold">等级</span><select aria-label="等级" value={levelCode} onChange={(event) => setLevelCode(event.target.value)} className={inputClass}>{levels.map((level) => <option key={level.id} value={level.code}>{level.code}级 · {level.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-bold">分类号（必填）</span><input aria-label="分类号" required value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} className={inputClass} placeholder="如 4.1.1" /></label><label className="block"><span className="mb-2 block text-sm font-bold">知识点名称（可选）</span><input aria-label="知识点名称（可选）" value={knowledgePointName} onChange={(event) => setKnowledgePointName(event.target.value)} className={inputClass} placeholder="如 力学基础" /></label></div><p className="mt-3 text-xs leading-6 text-[var(--muted-foreground)]">等级与分类号将应用到 Word 文件解析出的全部题目。</p></div> : null}{error ? <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}<Button className="mt-4 w-full" onClick={submit} disabled={!file || pending}>{isWord ? <FileText className="size-4" /> : <FileSpreadsheet className="size-4" />}{pending ? "正在解析…" : "开始预检"}</Button>{!isWord ? <div className="mt-5 rounded-2xl bg-sky-50 p-4 text-sm leading-7 text-sky-800"><strong>标准表头：</strong><br />等级、题库编号、分类号、知识点名称、题目编号、问题、答案、选项规格、A～F、是否启用。</div> : null}</CardContent></Card><Card><CardHeader><CardTitle>预检结果</CardTitle><CardDescription>{preview?.source === "WORD" ? "来源标记：第 N 题" : `工作表：${preview?.sheetNames.join("、") || "尚未解析"}`}；完整数据保存在服务器，页面仅展示前 100 行。</CardDescription></CardHeader><CardContent>{preview ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="总行数" value={preview.stats.totalRows} /><Metric label="可导入" value={preview.stats.validRows} tone="green" /><Metric label="警告" value={preview.stats.warningRows} tone="amber" /><Metric label="错误" value={preview.stats.errorRows} tone="red" /></div><div className="mt-5 max-h-[520px] overflow-auto rounded-2xl border border-[var(--border)]"><table className="min-w-[760px] w-full text-left text-sm"><thead className="sticky top-0 bg-[var(--muted)]"><tr><Th>来源</Th><Th>题目</Th><Th>分类</Th><Th>规格</Th><Th>结果</Th></tr></thead><tbody>{preview.rows.map((item, index) => { const hasError = item.issues.some((issue) => issue.severity === "error"); const hasWarning = item.issues.some((issue) => issue.severity === "warning"); return <tr key={`${item.row.sheetName ?? "sheet"}-${item.row.rowNumber}-${index}`} className="border-t border-[var(--border)]"><Td>{item.row.locationLabel ?? (item.row.sheetName ? `${item.row.sheetName}!${item.row.rowNumber}` : `第 ${item.row.rowNumber} 行`)}</Td><Td><div className="max-w-72 truncate font-semibold">{item.row.stem}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{item.row.externalQuestionCode}</div></Td><Td>{item.row.levelCode}级 · {item.row.categoryCode}</Td><Td>{item.selectionSpec}</Td><Td>{hasError ? <Status icon={XCircle} tone="red" label={item.issues[0].message} /> : hasWarning ? <Status icon={AlertTriangle} tone="amber" label={item.issues[0].message} /> : <Status icon={CheckCircle2} tone="green" label="通过" />}</Td></tr>; })}</tbody></table></div>{commitResult ? <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{commitResult}</div> : null}<Button className="mt-5" disabled={preview.stats.errorRows > 0 || committing} onClick={commit}>{committing ? "正在导入…" : `确认导入 ${preview.stats.validRows} 道题`}</Button></> : <div className="grid min-h-96 place-items-center text-center"><div><FileSpreadsheet className="mx-auto size-12 text-[var(--border)]" /><div className="mt-4 font-bold text-[var(--muted-foreground)]">上传文件后查看逐行结果</div><div className="mt-2 text-sm text-[var(--muted-foreground)]">当前页面只执行预检，不会修改题库</div></div></div>}</CardContent></Card></div>;
}
function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "green" | "amber" | "red" }) { const style = { neutral: "bg-[var(--muted)]", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-rose-50 text-rose-700" }[tone]; return <div className={`rounded-xl p-3 ${style}`}><div className="text-xs">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div>; }
function Status({ icon: Icon, tone, label }: { icon: typeof XCircle; tone: "red" | "amber" | "green"; label: string }) { const style = { red: "text-rose-700", amber: "text-amber-700", green: "text-emerald-700" }[tone]; return <div className={`flex max-w-64 items-center gap-2 ${style}`}><Icon className="size-4 shrink-0" /><span className="truncate">{label}</span></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)]">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3">{children}</td>; }
