"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleX, Clock3, Radio, RotateCcw, SignalHigh, Sparkles, Target } from "lucide-react";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PublicAnswerResult, PublicPracticeSession } from "@/lib/domain/types";

type Session = PublicPracticeSession;
type AnswerResult = PublicAnswerResult;

export function PracticeRunner({ session }: { session: Session }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, AnswerResult>>(session.initialResults);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const question = session.questions[index];
  const result = results[question.id];
  const answeredCount = Object.keys(results).length;
  const completed = answeredCount === session.questions.length;
  const correctCount = Object.values(results).filter((item) => item.isCorrect).length;
  const progress = completed ? 100 : Math.round((answeredCount / session.total) * 100);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleOption(optionId: string) {
    if (result) return;
    setError("");
    if (question.type === "SINGLE_CHOICE") setSelected([optionId]);
    else setSelected((current) => current.includes(optionId) ? current.filter((id) => id !== optionId) : current.length < question.correctOptionCount ? [...current, optionId] : current);
  }

  async function submit() {
    if (selected.length !== question.correctOptionCount) {
      setError(`本题要求选择 ${question.correctOptionCount} 项`);
      return;
    }
    setPending(true);
    setError("");
    const response = await authenticatedFetch(`/api/v1/practice-sessions/${session.id}/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id, selectedOptionIds: selected }) });
    const data = await response.json();
    setPending(false);
    if (!response.ok) { setError(data.message ?? "提交失败"); return; }
    setResults((current) => ({ ...current, [question.id]: data }));
  }

  function move(direction: number) {
    const next = Math.min(session.questions.length - 1, Math.max(0, index + direction));
    setIndex(next);
    setSelected([]);
    setError("");
  }

  if (completed) return <ResultSummary title={session.title} correct={correctCount} total={session.total} />;

  return (
    <div className="safe-bottom mx-auto max-w-6xl">
      <header className="mb-5 flex items-center justify-between gap-4">
        <Link href="/student" className="group flex items-center gap-2 text-sm font-extrabold text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"><ArrowLeft className="size-4 transition group-hover:-translate-x-1" />退出练习</Link>
        <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--muted-foreground)] shadow-sm"><span className="size-1.5 rounded-full bg-emerald-400 signal-glow" /><Clock3 className="size-3.5" />专注频道已开启</div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
        <Card className="overflow-hidden border-slate-200/80 shadow-[0_28px_80px_rgba(12,39,58,.12)]">
          <div className="surface-grid border-b border-[var(--border)] bg-[linear-gradient(135deg,#f8fbfc,#edf6f7)] px-5 py-5 sm:px-8">
            <div className="flex items-center justify-between gap-5"><div><div className="text-[10px] font-black tracking-[0.18em] text-[var(--primary)]">ACTIVE QUESTION</div><div className="mt-1 text-sm font-black">第 {index + 1} / {session.total} 题</div></div><div className="min-w-32 flex-1 sm:max-w-72"><div className="mb-2 flex justify-between text-[10px] font-bold text-[var(--muted-foreground)]"><span>{session.title}</span><span>{progress}%</span></div><Progress value={progress} /></div></div>
          </div>
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{question.type === "SINGLE_CHOICE" ? "单选题" : "多选题"}</Badge><Badge>{question.selectionSpec}</Badge><Badge tone="green">{question.levelCode}级</Badge><Badge>{question.knowledgeName}</Badge><span className="ml-auto hidden items-center gap-1.5 text-xs font-bold text-[var(--muted-foreground)] sm:flex"><SignalHigh className="size-4 text-[var(--primary)]" />题目信号已锁定</span></div>
            <h1 className="mt-7 text-xl font-black leading-9 tracking-[-0.028em] text-[var(--ink)] sm:text-2xl lg:text-[28px] lg:leading-[1.55]">{question.stem}</h1>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--muted)] px-3 py-2.5 text-sm font-semibold text-[var(--muted-foreground)]"><Target className="size-4 shrink-0 text-[var(--primary)]" />{question.type === "MULTIPLE_CHOICE" ? `请选择 ${question.correctOptionCount} 项，所选答案全部一致才得分。` : "请选择一个最符合题意的答案。"}</div>

            <div className="mt-7 flex flex-col gap-3">{question.options.map((option) => {
              const chosen = selectedSet.has(option.id);
              const correct = result?.correctOptionIds.includes(option.id);
              const wrongChosen = Boolean(result && chosen && !correct);
              return <button key={option.id} type="button" onClick={() => toggleOption(option.id)} className={cn("group flex min-h-16 items-center gap-4 rounded-2xl border p-4 text-left transition duration-200 sm:p-5", !result && chosen && "-translate-y-0.5 border-cyan-500 bg-cyan-50 shadow-[0_12px_28px_rgba(7,139,152,.12)]", !result && !chosen && "border-[var(--border)] bg-white hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_12px_28px_rgba(17,50,72,.08)]", result && correct && "border-emerald-400 bg-emerald-50", wrongChosen && "border-rose-400 bg-rose-50")}><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border text-sm font-black transition", chosen ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_8px_18px_rgba(7,139,152,.22)]" : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] group-hover:border-cyan-300 group-hover:text-[var(--primary)]", result && correct && "border-emerald-600 bg-emerald-600 text-white", wrongChosen && "border-rose-500 bg-rose-500 text-white")}>{result && correct ? <Check className="size-4" /> : option.id}</span><span className="font-semibold leading-7">{option.text}</span></button>;
            })}</div>

            {error ? <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
            {result ? <div className={cn("mt-5 flex items-start gap-3 rounded-2xl border p-4", result.isCorrect ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800")}>{result.isCorrect ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <CircleX className="mt-0.5 size-5 shrink-0" />}<div><div className="font-black">{result.isCorrect ? "回答正确，信号匹配" : "回答错误，需要重新校准"}</div><div className="mt-1 text-sm leading-6">标准答案：{result.correctOptionIds.join("、")}。解析功能将在第二阶段由教师审核后开放。</div></div></div> : null}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-6"><Button variant="outline" onClick={() => move(-1)} disabled={index === 0}><ArrowLeft className="size-4" />上一题</Button><div className="hidden text-xs font-bold text-[var(--muted-foreground)] sm:block">已选择 {selected.length} / {question.correctOptionCount} 项</div>{result ? <Button onClick={() => move(1)}>{index === session.questions.length - 1 ? "查看结果" : "下一题"}<ArrowRight className="size-4" /></Button> : <Button onClick={submit} disabled={pending}>{pending ? "正在校验…" : "提交本题"}</Button>}</div>
          </CardContent>
        </Card>

        <aside className="hidden xl:flex xl:flex-col xl:gap-5">
          <Card className="overflow-hidden bg-[var(--ink)] text-white"><CardContent><div className="flex items-center justify-between"><div className="text-[10px] font-black tracking-[0.2em] text-cyan-100/50">QUESTION RADAR</div><Radio className="size-4 text-cyan-300" /></div><div className="mt-5 grid grid-cols-5 gap-2">{session.questions.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => { setIndex(itemIndex); setSelected([]); setError(""); }} className={cn("grid aspect-square place-items-center rounded-lg text-xs font-black transition", itemIndex === index ? "bg-cyan-400 text-[var(--ink)] shadow-[0_0_22px_rgba(34,211,217,.35)]" : results[item.id] ? results[item.id].isCorrect ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20" : "bg-rose-400/15 text-rose-300 ring-1 ring-rose-300/20" : "bg-white/[.06] text-slate-400 hover:bg-white/[.1] hover:text-white")}>{itemIndex + 1}</button>)}</div><div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500"><span><i className="mx-auto mb-1 block size-1.5 rounded-full bg-cyan-300" />当前</span><span><i className="mx-auto mb-1 block size-1.5 rounded-full bg-emerald-300" />正确</span><span><i className="mx-auto mb-1 block size-1.5 rounded-full bg-rose-300" />错误</span></div></CardContent></Card>
          <Card><CardContent><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Sparkles className="size-5" /></div><div><div className="text-sm font-black">答题提示</div><div className="text-xs text-[var(--muted-foreground)]">多选题不提供部分分</div></div></div><p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">提交后答案会立即锁定。遇到不确定的题目，可先查看题目所属知识点再判断。</p></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

function ResultSummary({ title, correct, total }: { title: string; correct: number; total: number }) {
  const rate = Math.round((correct / total) * 100);
  return <div className="mx-auto grid min-h-[85vh] max-w-3xl place-items-center px-4"><Card className="scan-line w-full overflow-hidden text-center shadow-[0_32px_100px_rgba(8,31,49,.16)]"><div className="surface-grid bg-[var(--ink)] px-6 py-10 text-white"><div className="radio-waves mx-auto grid size-20 place-items-center rounded-full bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-200/20"><CheckCircle2 className="relative z-10 size-10" /></div><div className="mt-6 text-[10px] font-black tracking-[0.24em] text-cyan-100/50">MISSION COMPLETE</div><h1 className="mt-2 text-3xl font-black tracking-[-0.045em]">练习完成</h1><p className="mt-2 text-sm text-slate-400">{title}</p></div><CardContent className="p-8 sm:p-12"><div className="stat-number text-7xl font-black text-[var(--primary)]">{rate}<span className="text-2xl">%</span></div><p className="mt-3 text-sm font-semibold text-[var(--muted-foreground)]">答对 {correct} 题，共 {total} 题</p><div className="mx-auto mt-7 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[linear-gradient(90deg,#0a8b98,#21c4ca,#f1ae53)]" style={{ width: `${rate}%` }} /></div><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/student"><Button variant="outline">返回首页</Button></Link><Link href="/student/practice?mode=level&level=A"><Button><RotateCcw className="size-4" />再练一次</Button></Link></div></CardContent></Card></div>;
}
