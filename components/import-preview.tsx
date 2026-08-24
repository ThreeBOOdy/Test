"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, BookType, CheckCircle2, FileSpreadsheet, FileText, UploadCloud, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";

type PreviewRowImage = { id: string; field: string; mimeType: string; sizeBytes: number };

type PreviewRow = {
  row: {
    rowNumber: number;
    sheetName?: string;
    locationLabel?: string;
    externalQuestionCode?: string;
    stem: string;
    categoryCode: string;
  };
  selectionSpec: string;
  type: string;
  issues: Array<{ severity: "warning" | "error"; field: string; message: string }>;
  images?: PreviewRowImage[];
};

type Preview = {
  batchId: string;
  fileName: string;
  source: "EXCEL" | "WORD";
  sheetNames: string[];
  stats: { totalRows: number; validRows: number; warningRows: number; errorRows: number };
  rows: PreviewRow[];
};

export type KnowledgePointTypeChoice = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
};

export type LevelChoice = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
};

type LevelWizard = {
  questionIds: string[];
  selectedLevelIds: string[];
  assigning: boolean;
  message: string;
};

type ImportPreviewProps = {
  knowledgePointTypes?: KnowledgePointTypeChoice[];
  levels?: LevelChoice[];
};

const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20";

export function ImportPreview({ knowledgePointTypes = [], levels = [] }: ImportPreviewProps) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [knowledgePointName, setKnowledgePointName] = useState("");
  const [typeMode, setTypeMode] = useState<"existing" | "create">("existing");
  const [knowledgePointTypeId, setKnowledgePointTypeId] = useState("");
  const [knowledgePointTypeCode, setKnowledgePointTypeCode] = useState("");
  const [knowledgePointTypeName, setKnowledgePointTypeName] = useState("");
  const [singleSheetWizardApplied, setSingleSheetWizardApplied] = useState(false);
  const [levelWizard, setLevelWizard] = useState<LevelWizard | null>(null);

  const isWord = file?.name.toLowerCase().endsWith(".docx") ?? false;
  const isSingleSheetExcel = preview?.source === "EXCEL" && preview.sheetNames.length === 1;
  const isMultiSheetExcel = preview?.source === "EXCEL" && preview.sheetNames.length > 1;

  function resetWizardState() {
    setCategoryCode("");
    setKnowledgePointName("");
    setTypeMode("existing");
    setKnowledgePointTypeId("");
    setKnowledgePointTypeCode("");
    setKnowledgePointTypeName("");
    setSingleSheetWizardApplied(false);
    setLevelWizard(null);
  }

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    setFile(next);
    setPreview(undefined);
    setError("");
    setCommitResult("");
    resetWizardState();
  }

  function wizardTypeFields(): Record<string, string> {
    if (typeMode === "create") {
      const fields: Record<string, string> = {};
      if (knowledgePointTypeCode.trim()) fields.knowledgePointTypeCode = knowledgePointTypeCode.trim();
      if (knowledgePointTypeName.trim()) fields.knowledgePointTypeName = knowledgePointTypeName.trim();
      return fields;
    }
    const selected = knowledgePointTypes.find((type) => type.id === knowledgePointTypeId);
    if (!selected) return {};
    return {
      knowledgePointTypeId: selected.id,
      knowledgePointTypeCode: selected.code,
      knowledgePointTypeName: selected.name,
    };
  }

  function validateTypeChoice(): string {
    if (typeMode === "create") {
      if (!knowledgePointTypeName.trim()) return "请填写新大类知识点名称";
      if (!knowledgePointTypeCode.trim()) return "请填写新大类知识点代码";
      return "";
    }
    if (!knowledgePointTypeId) return "请选择大类知识点（类型）";
    return "";
  }

  async function submit() {
    if (!file) return;
    if (isWord) {
      if (!categoryCode.trim()) {
        setError("Word 导入需要填写分类号");
        return;
      }
      const typeError = validateTypeChoice();
      if (typeError) {
        setError(typeError);
        return;
      }
    }
    setPending(true);
    setError("");
    setCommitResult("");
    const body = new FormData();
    body.set("file", file);
    if (isWord) {
      body.set("categoryCode", categoryCode.trim());
      if (knowledgePointName.trim()) body.set("knowledgePointName", knowledgePointName.trim());
      for (const [key, value] of Object.entries(wizardTypeFields())) body.set(key, value);
    } else if (singleSheetWizardApplied) {
      if (categoryCode.trim()) body.set("categoryCode", categoryCode.trim());
      if (knowledgePointName.trim()) body.set("knowledgePointName", knowledgePointName.trim());
      for (const [key, value] of Object.entries(wizardTypeFields())) body.set(key, value);
    }
    const response = await fetch("/api/v1/teacher/imports/preview", { method: "POST", body });
    const data = await response.json();
    setPending(false);
    if (!response.ok) { setError(data.message ?? "解析失败"); return; }
    setPreview(data);
  }

  async function applySingleSheetWizard() {
    if (!file || !preview) return;
    const typeError = validateTypeChoice();
    if (typeError) {
      setError(typeError);
      return;
    }
    setPending(true);
    setError("");
    setCommitResult("");
    const body = new FormData();
    body.set("file", file);
    if (categoryCode.trim()) body.set("categoryCode", categoryCode.trim());
    if (knowledgePointName.trim()) body.set("knowledgePointName", knowledgePointName.trim());
    for (const [key, value] of Object.entries(wizardTypeFields())) body.set(key, value);
    const response = await fetch("/api/v1/teacher/imports/preview", { method: "POST", body });
    const data = await response.json();
    setPending(false);
    if (!response.ok) { setError(data.message ?? "应用向导失败"); return; }
    setPreview(data);
    setSingleSheetWizardApplied(true);
  }

  async function commit() {
    if (!preview) return;
    if (isSingleSheetExcel && !singleSheetWizardApplied) {
      setError("单 sheet Excel 请先应用上方的大类/小类向导");
      return;
    }
    setCommitting(true);
    setError("");
    const response = await fetch("/api/v1/teacher/imports/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: preview.batchId }) });
    const data = await response.json();
    setCommitting(false);
    if (!response.ok) { setError(data.message ?? "导入失败"); return; }
    setCommitResult(`成功导入 ${data.inserted} 道题，跳过重复 ${data.skipped} 道`);
    if (Array.isArray(data.questionIds) && data.questionIds.length > 0) {
      setLevelWizard({ questionIds: data.questionIds, selectedLevelIds: [], assigning: false, message: "" });
    }
    router.refresh();
  }

  async function assignLevels() {
    if (!levelWizard || levelWizard.selectedLevelIds.length === 0) return;
    setLevelWizard({ ...levelWizard, assigning: true, message: "" });
    const response = await authenticatedFetch("/api/v1/teacher/questions/levels/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: levelWizard.questionIds, levelIds: levelWizard.selectedLevelIds }),
    });
    const data = await response.json();
    if (!response.ok) {
      setLevelWizard({ ...levelWizard, assigning: false, message: data.message ?? "拉取字母类失败" });
      return;
    }
    const selectedCodes = levels.filter((level) => levelWizard.selectedLevelIds.includes(level.id)).map((level) => `${level.code}级`).join("、");
    setLevelWizard(null);
    setCommitResult(`已拉取到 ${selectedCodes || "所选字母类"}，共 ${data.assigned} 条关联。`);
    router.refresh();
  }

  function selectedTypeLabel() {
    if (typeMode === "create") return knowledgePointTypeName.trim() || knowledgePointTypeCode.trim() || "新建类型";
    return knowledgePointTypes.find((type) => type.id === knowledgePointTypeId)?.name ?? "未选择类型";
  }

  return <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
    <Card>
      <CardHeader><CardTitle>上传题库文件</CardTitle><CardDescription>支持 Excel 表格与 Word 题库模板；预检会解析文件内全部内容，并保留来源定位。</CardDescription></CardHeader>
      <CardContent>
        <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)] p-6 text-center hover:border-emerald-400">
          {isWord ? <FileText className="size-10 text-[var(--primary)]" /> : <UploadCloud className="size-10 text-[var(--primary)]" />}
          <div className="mt-4 font-extrabold">选择 .xlsx 或 .docx 文件</div>
          <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{isWord ? "按小鹅通 Word 批量导入模板解析题号、选项、答案与解析，最多预检 5000 题" : "每个工作表第一行必须是表头，全部工作表合计最多预检 5000 行"}</div>
          <input type="file" accept=".xlsx,.docx" aria-label="选择 .xlsx 或 .docx 文件" className="sr-only" onChange={chooseFile} />
          {file ? <Badge className="mt-4" tone="green">{file.name}</Badge> : null}
        </label>
        {isWord ? <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="mb-3 text-sm font-bold">单 sheet/Word 导入向导</div>
          <div className="grid gap-4">
            <TypeFields
              typeMode={typeMode}
              setTypeMode={setTypeMode}
              knowledgePointTypes={knowledgePointTypes}
              knowledgePointTypeId={knowledgePointTypeId}
              setKnowledgePointTypeId={setKnowledgePointTypeId}
              knowledgePointTypeCode={knowledgePointTypeCode}
              setKnowledgePointTypeCode={setKnowledgePointTypeCode}
              knowledgePointTypeName={knowledgePointTypeName}
              setKnowledgePointTypeName={setKnowledgePointTypeName}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-2 block text-sm font-bold">分类号（必填）</span><input aria-label="分类号" required value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} className={inputClass} placeholder="如 4.1.1" /></label>
              <label className="block"><span className="mb-2 block text-sm font-bold">知识点名称（可选）</span><input aria-label="知识点名称（可选）" value={knowledgePointName} onChange={(event) => setKnowledgePointName(event.target.value)} className={inputClass} placeholder="如 力学基础" /></label>
            </div>
            <p className="text-xs leading-6 text-[var(--muted-foreground)]">分类号将应用到 Word 文件解析出的全部题目。</p>
          </div>
        </div> : null}
        {error ? <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        <Button className="mt-4 w-full" onClick={submit} disabled={!file || pending}>{isWord ? <FileText className="size-4" /> : <FileSpreadsheet className="size-4" />}{pending ? "正在解析…" : "开始预检"}</Button>
        {!isWord ? <div className="mt-5 rounded-2xl bg-sky-50 p-4 text-sm leading-7 text-sky-800"><strong>标准表头：</strong><br />题库编号、分类号、知识点名称、题目编号、问题、答案、选项规格、A～F、是否启用。</div> : null}
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>预检结果</CardTitle>
        <CardDescription>{preview?.source === "WORD" ? "来源标记：第 N 题" : `工作表：${preview?.sheetNames.join("、") || "尚未解析"}`}；完整数据保存在服务器，页面仅展示前 100 行。</CardDescription>
      </CardHeader>
      <CardContent>
        {preview ? <>
          {isMultiSheetExcel ? <div className="mb-5 rounded-2xl border border-emerald-600/20 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><div className="flex items-start gap-3"><BookType className="mt-0.5 size-5 shrink-0" /><div><div className="font-extrabold">多 sheet 自动识别</div><div className="mt-1">已识别 {preview.sheetNames.length} 个工作表，提交时将按工作表名自动创建/匹配知识点类型：{preview.sheetNames.join("、")}。文件内的分类号继续作为各类型下的小类知识点。</div></div></div></div> : null}
          {isSingleSheetExcel ? <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="mb-3 text-sm font-bold">单 sheet 导入向导</div>
            <div className="grid gap-4">
              <TypeFields
                typeMode={typeMode}
                setTypeMode={setTypeMode}
                knowledgePointTypes={knowledgePointTypes}
                knowledgePointTypeId={knowledgePointTypeId}
                setKnowledgePointTypeId={setKnowledgePointTypeId}
                knowledgePointTypeCode={knowledgePointTypeCode}
                setKnowledgePointTypeCode={setKnowledgePointTypeCode}
                knowledgePointTypeName={knowledgePointTypeName}
                setKnowledgePointTypeName={setKnowledgePointTypeName}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-bold">分类号（可选覆盖）</span><input aria-label="分类号（可选覆盖）" value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} className={inputClass} placeholder="留空则使用文件每行的分类号" /></label>
                <label className="block"><span className="mb-2 block text-sm font-bold">知识点名称（可选覆盖）</span><input aria-label="知识点名称（可选覆盖）" value={knowledgePointName} onChange={(event) => setKnowledgePointName(event.target.value)} className={inputClass} placeholder="留空则使用文件每行的知识点名称" /></label>
              </div>
              <p className="text-xs leading-6 text-[var(--muted-foreground)]">该文件只有一个工作表，需要指定大类；分类号默认取文件每行的值，也可统一覆盖。</p>
              {singleSheetWizardApplied ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">已应用向导：将导入到「{selectedTypeLabel()}」。</div> : null}
              <Button variant="outline" disabled={pending} onClick={applySingleSheetWizard}>{pending ? "正在应用…" : "应用向导并重新预检"}</Button>
            </div>
          </div> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="总行数" value={preview.stats.totalRows} />
            <Metric label="可导入" value={preview.stats.validRows} tone="green" />
            <Metric label="警告" value={preview.stats.warningRows} tone="amber" />
            <Metric label="错误" value={preview.stats.errorRows} tone="red" />
          </div>
          <div className="mt-5 max-h-[520px] overflow-auto rounded-2xl border border-[var(--border)]">
            <table className="responsive-data-table min-w-[760px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--muted)]">
                <tr><Th>来源</Th><Th>题目</Th><Th>分类</Th><Th>规格</Th><Th>结果</Th></tr>
              </thead>
              <tbody>
                {preview.rows.map((item, index) => {
                  const hasError = item.issues.some((issue) => issue.severity === "error");
                  const hasWarning = item.issues.some((issue) => issue.severity === "warning");
                  return <tr key={`${item.row.sheetName ?? "sheet"}-${item.row.rowNumber}-${index}`} className="border-t border-[var(--border)]">
                    <Td label="来源">{item.row.locationLabel ?? (item.row.sheetName ? `${item.row.sheetName}!${item.row.rowNumber}` : `第 ${item.row.rowNumber} 行`)}</Td>
                    <Td label="题目">
                      <div className="max-w-72 truncate font-semibold">{item.row.stem}</div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">{item.row.externalQuestionCode}</div>
                      {item.images?.length ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-[var(--muted-foreground)]">图片 {item.images.length} 张</span>{item.images.map((image) => <Image key={image.id} src={`/api/v1/teacher/import-batches/${preview.batchId}/images/${image.id}`} alt={`题目图片 ${image.id}`} width={64} height={64} unoptimized className="h-16 w-auto max-w-40 rounded-lg border border-[var(--border)] bg-white object-contain" />)}</div> : null}
                    </Td>
                    <Td label="分类">{item.row.categoryCode}</Td>
                    <Td label="规格">{item.selectionSpec}</Td>
                    <Td label="结果">{hasError ? <Status icon={XCircle} tone="red" label={item.issues[0].message} /> : hasWarning ? <Status icon={AlertTriangle} tone="amber" label={item.issues[0].message} /> : <Status icon={CheckCircle2} tone="green" label="通过" />}</Td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {commitResult ? <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{commitResult}</div> : null}
          <Button className="mt-5" disabled={preview.stats.errorRows > 0 || committing || (isSingleSheetExcel && !singleSheetWizardApplied)} onClick={commit}>{committing ? "正在导入…" : `确认导入 ${preview.stats.validRows} 道题`}</Button>
        </> : <div className="grid min-h-96 place-items-center text-center">
          <div><FileSpreadsheet className="mx-auto size-12 text-[var(--border)]" /><div className="mt-4 font-bold text-[var(--muted-foreground)]">上传文件后查看逐行结果</div><div className="mt-2 text-sm text-[var(--muted-foreground)]">当前页面只执行预检，不会修改题库</div></div>
        </div>}
      </CardContent>
    </Card>
    {levelWizard ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="字母类归类向导">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-extrabold">字母类归类向导</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">本次新导入 {levelWizard.questionIds.length} 道题已进入公共题池，可拉取到一个或多个字母类。</p></div>
          <Button type="button" variant="ghost" size="sm" aria-label="关闭" onClick={() => setLevelWizard(null)}><XCircle className="size-5" /></Button>
        </div>
        {levels.length > 0 ? <div className="mt-5 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] p-2">
          {levels.map((level) => {
            const selected = levelWizard.selectedLevelIds.includes(level.id);
            return <label key={level.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-[var(--surface-soft)]">
              <input type="checkbox" aria-label={`字母类 ${level.code}`} checked={selected} onChange={(event) => setLevelWizard({ ...levelWizard, selectedLevelIds: event.target.checked ? [...levelWizard.selectedLevelIds, level.id] : levelWizard.selectedLevelIds.filter((id) => id !== level.id) })} className="size-4 accent-[var(--primary)]" />
              <span><span className="font-bold">{level.code}级</span></span>
            </label>;
          })}
        </div> : <div className="mt-5 rounded-xl bg-[var(--muted)] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">尚未配置启用的字母类，可稍后在题目管理中批量归类。</div>}
        {levelWizard.message ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{levelWizard.message}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLevelWizard(null)}>暂不归类</Button>
          <Button type="button" disabled={levelWizard.selectedLevelIds.length === 0 || levelWizard.assigning} onClick={assignLevels}>{levelWizard.assigning ? "正在拉取…" : "拉取到所选字母类"}</Button>
        </div>
      </div>
    </div> : null}
  </div>;
}

function TypeFields({
  typeMode,
  setTypeMode,
  knowledgePointTypes,
  knowledgePointTypeId,
  setKnowledgePointTypeId,
  knowledgePointTypeCode,
  setKnowledgePointTypeCode,
  knowledgePointTypeName,
  setKnowledgePointTypeName,
}: {
  typeMode: "existing" | "create";
  setTypeMode: (mode: "existing" | "create") => void;
  knowledgePointTypes: KnowledgePointTypeChoice[];
  knowledgePointTypeId: string;
  setKnowledgePointTypeId: (id: string) => void;
  knowledgePointTypeCode: string;
  setKnowledgePointTypeCode: (code: string) => void;
  knowledgePointTypeName: string;
  setKnowledgePointTypeName: (name: string) => void;
}) {
  const enabledTypes = knowledgePointTypes.filter((type) => type.enabled);
  return <div className="grid gap-4">
    <div>
      <span className="mb-2 block text-sm font-bold">大类知识点（类型）</span>
      <div className="flex gap-2">
        <label className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${typeMode === "existing" ? "border-[var(--ring)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}>
          <input type="radio" name="typeMode" value="existing" checked={typeMode === "existing"} onChange={() => setTypeMode("existing")} className="sr-only" />
          选择已有类型
        </label>
        <label className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${typeMode === "create" ? "border-[var(--ring)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}>
          <input type="radio" name="typeMode" value="create" checked={typeMode === "create"} onChange={() => setTypeMode("create")} className="sr-only" />
          新建类型
        </label>
      </div>
    </div>
    {typeMode === "existing" ? (
      <label className="block">
        <span className="mb-2 block text-sm font-bold">选择类型</span>
        <select aria-label="大类知识点（类型）" value={knowledgePointTypeId} onChange={(event) => setKnowledgePointTypeId(event.target.value)} className={inputClass}>
          <option value="">请选择知识点类型</option>
          {enabledTypes.map((type) => <option key={type.id} value={type.id}>{type.name}（{type.code}）</option>)}
        </select>
        {enabledTypes.length === 0 ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">当前没有启用的知识点类型，请切换到“新建类型”。</p> : null}
      </label>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-2 block text-sm font-bold">类型代码</span><input aria-label="新类型代码" value={knowledgePointTypeCode} onChange={(event) => setKnowledgePointTypeCode(event.target.value)} className={inputClass} placeholder="如 DG、TX" /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">类型名称</span><input aria-label="新类型名称" value={knowledgePointTypeName} onChange={(event) => setKnowledgePointTypeName(event.target.value)} className={inputClass} placeholder="如 电工基础" /></label>
      </div>
    )}
  </div>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "green" | "amber" | "red" }) {
  const style = { neutral: "bg-[var(--muted)]", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-rose-50 text-rose-700" }[tone];
  return <div className={`rounded-xl p-3 ${style}`}><div className="text-xs">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div>;
}

function Status({ icon: Icon, tone, label }: { icon: typeof XCircle; tone: "red" | "amber" | "green"; label: string }) {
  const style = { red: "text-rose-700", amber: "text-amber-700", green: "text-emerald-700" }[tone];
  return <div className={`flex max-w-64 items-center gap-2 ${style}`}><Icon className="size-4 shrink-0" /><span className="truncate">{label}</span></div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)]">{children}</th>;
}

function Td({ children, label, actions = false }: { children: React.ReactNode; label?: string; actions?: boolean }) {
  return <td data-label={label} data-actions={actions || undefined} className="px-4 py-3">{children}</td>;
}
