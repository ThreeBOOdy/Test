"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleX, Clock3, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PublicQuestion } from "@/lib/server/demo-session-store";

type Session = { id: string; title: string; total: number; questions: PublicQuestion[] };
type AnswerResult = { isCorrect: boolean; correctOptionIds: string[]; answeredCount: number; correctCount: number };

export function PracticeRunner({ session }: { session: Session }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const question = session.questions[index];
  const result = results[question.id];
  const completed = Object.keys(results).length === session.questions.length;
  const correctCount = Object.values(results).filter((item) => item.isCorrect).length;
  const progress = completed ? 100 : Math.round((Object.keys(results).length / session.total) * 100);
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
    const response = await fetch(`/api/v1/practice-sessions/${session.id}/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id, selectedOptionIds: selected }) });
    const data = await response.json();
    setPending(false);
    if (!response.ok) { setError(data.message ?? "提交失败"); return; }
    setResults((current) => ({ ...current, [question.id]: data }));
  }

  function move(direction: number) {
    const next = Math.min(session.questions.length - 1, Math.max(0, index + direction));
    setIndex(next);
    setSelected(results[session.questions[next].id] ? [] : []);
    setError("");
  }

  if (completed) return <ResultSummary title={session.title} correct={correctCount} total={session.total} />;

  return <div className="safe-bottom mx-auto max-w-4xl"><div className="mb-6 flex items-center justify-between"><Link href="/student" className="flex items-center gap-2 text-sm font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="size-4" />退出练习</Link><div className="flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]"><Clock3 className="size-4" />练习中</div></div><Card className="overflow-hidden"><div className="border-b border-[var(--border)] bg-[var(--muted)] px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-semibold text-[var(--muted-foreground)]">{session.title}</div><div className="mt-1 text-sm font-extrabold">第 {index + 1} / {session.total} 题</div></div><div className="min-w-28 flex-1 sm:max-w-56"><Progress value={progress} /></div></div></div><CardContent className="p-5 sm:p-8"><div className="flex flex-wrap gap-2"><Badge tone={question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{question.type === "SINGLE_CHOICE" ? "单选题" : "多选题"}</Badge><Badge>{question.selectionSpec}</Badge><Badge tone="green">{question.levelCode}级</Badge><Badge>{question.knowledgeName}</Badge></div><h1 className="mt-6 text-xl font-extrabold leading-9 tracking-[-0.025em] sm:text-2xl">{question.stem}</h1><p className="mt-3 text-sm text-[var(--muted-foreground)]">{question.type === "MULTIPLE_CHOICE" ? `请选择 ${question.correctOptionCount} 项，全部正确才得分。` : "请选择一个最符合题意的答案。"}</p><div className="mt-7 flex flex-col gap-3">{question.options.map((option) => { const chosen = selectedSet.has(option.id); const correct = result?.correctOptionIds.includes(option.id); const wrongChosen = Boolean(result && chosen && !correct); return <button key={option.id} type="button" onClick={() => toggleOption(option.id)} className={cn("flex min-h-16 items-center gap-4 rounded-2xl border p-4 text-left transition", !result && chosen && "border-[var(--primary)] bg-emerald-50", !result && !chosen && "border-[var(--border)] bg-white hover:border-emerald-300", result && correct && "border-emerald-400 bg-emerald-50", wrongChosen && "border-rose-400 bg-rose-50")}><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border text-sm font-extrabold", chosen ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--muted)]", result && correct && "border-emerald-600 bg-emerald-600 text-white", wrongChosen && "border-rose-500 bg-rose-500 text-white")}>{result && correct ? <Check className="size-4" /> : option.id}</span><span className="font-semibold leading-6">{option.text}</span></button>; })}</div>{error ? <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}{result ? <div className={cn("mt-5 flex items-start gap-3 rounded-2xl p-4", result.isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>{result.isCorrect ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <CircleX className="mt-0.5 size-5 shrink-0" />}<div><div className="font-extrabold">{result.isCorrect ? "回答正确" : "回答错误"}</div><div className="mt-1 text-sm">标准答案：{result.correctOptionIds.join("、")}。解析功能将在第二阶段由教师审核后开放。</div></div></div> : null}<div className="mt-7 flex items-center justify-between gap-3"><Button variant="outline" onClick={() => move(-1)} disabled={index === 0}><ArrowLeft className="size-4" />上一题</Button>{result ? <Button onClick={() => move(1)}>{index === session.questions.length - 1 ? "查看结果" : "下一题"}<ArrowRight className="size-4" /></Button> : <Button onClick={submit} disabled={pending}>{pending ? "提交中…" : "提交本题"}</Button>}</div></CardContent></Card></div>;
}

function ResultSummary({ title, correct, total }: { title: string; correct: number; total: number }) {
  const rate = Math.round((correct / total) * 100);
  return <div className="mx-auto grid min-h-[75vh] max-w-2xl place-items-center px-4"><Card className="w-full text-center"><CardContent className="p-8 sm:p-12"><div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-10" /></div><h1 className="mt-6 text-3xl font-black tracking-[-0.04em]">练习完成</h1><p className="mt-2 text-[var(--muted-foreground)]">{title}</p><div className="stat-number mt-8 text-6xl font-black text-[var(--primary)]">{rate}<span className="text-2xl">%</span></div><p className="mt-3 text-sm text-[var(--muted-foreground)]">答对 {correct} 题，共 {total} 题</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/student"><Button variant="outline">返回首页</Button></Link><Link href="/student/practice?mode=level&level=A"><Button><RotateCcw className="size-4" />再练一次</Button></Link></div></CardContent></Card></div>;
}
