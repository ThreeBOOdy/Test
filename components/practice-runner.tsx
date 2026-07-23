"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleX, Clock3, Radio } from "lucide-react";
import { AnswerOption } from "@/components/training/answer-option";
import { PracticeSummary } from "@/components/training/practice-summary";
import { QuestionNavigator } from "@/components/training/question-navigator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpectrumProgress } from "@/components/visual/spectrum-progress";
import { getInitialQuestionIndex, toggleDraftSelection } from "@/lib/domain/practice-ui";
import type { PublicAnswerResult, PublicPracticeSession } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function PracticeRunner({ session }: { session: PublicPracticeSession }) {
  const [index, setIndex] = useState(() => getInitialQuestionIndex(session.questions, session.initialResults));
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, PublicAnswerResult>>(session.initialResults);
  const [summaryVisible, setSummaryVisible] = useState(
    () => Object.keys(session.initialResults).length === session.questions.length,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const question = session.questions[index];
  const result = results[question.id];
  const selected = useMemo(() => result?.selectedOptionIds ?? drafts[question.id] ?? [], [drafts, question.id, result?.selectedOptionIds]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const answeredCount = Object.keys(results).length;
  const completed = answeredCount === session.questions.length;
  const correctCount = Object.values(results).filter((item) => item.isCorrect).length;

  const moveTo = useCallback((nextIndex: number) => {
    setIndex(Math.min(session.questions.length - 1, Math.max(0, nextIndex)));
    setError("");
  }, [session.questions.length]);

  const toggleOption = useCallback((optionId: string) => {
    if (result || pending) return;
    setError("");
    setDrafts((current) => ({
      ...current,
      [question.id]: toggleDraftSelection(current[question.id] ?? [], optionId, question.type, question.correctOptionCount),
    }));
  }, [pending, question.correctOptionCount, question.id, question.type, result]);

  const submit = useCallback(async () => {
    if (result || pending) return;
    if (selected.length !== question.correctOptionCount) {
      setError(`本题要求选择 ${question.correctOptionCount} 项`);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/practice-sessions/${session.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedOptionIds: selected }),
      });
      const data = await response.json() as PublicAnswerResult & { message?: string };
      if (!response.ok) {
        setError(data.message ?? "提交失败，请稍后重试");
        return;
      }
      setResults((current) => ({ ...current, [question.id]: data }));
      setDrafts((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }, [pending, question.correctOptionCount, question.id, result, selected, session.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      if (/^[1-9]$/.test(event.key) && !result) {
        const option = question.options[Number(event.key) - 1];
        if (option) { event.preventDefault(); toggleOption(option.id); }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (!result) void submit();
        else if (completed) setSummaryVisible(true);
        else moveTo(index + 1);
        return;
      }
      if (event.key === "ArrowLeft") { event.preventDefault(); moveTo(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); moveTo(index + 1); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, index, moveTo, question.options, result, submit, toggleOption]);

  if (summaryVisible) return <PracticeSummary title={session.title} correct={correctCount} total={session.total} />;

  return <div className="safe-bottom mx-auto max-w-7xl">
    <div className="mb-5 flex items-center justify-between gap-4"><Link href="/student" className="flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="size-4" />退出训练</Link><div className="flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]"><Clock3 className="size-4" />训练频道已连接</div></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="overflow-hidden"><div className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-5 sm:px-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)]"><Radio className="size-3.5" />{session.title}</div><div className="mt-1 text-sm font-extrabold">第 {index + 1} / {session.total} 题</div></div><div className="w-full sm:max-w-64"><div className="mb-2 flex justify-between text-xs text-[var(--muted-foreground)]"><span>训练进度</span><span>{answeredCount} / {session.total}</span></div><SpectrumProgress answered={answeredCount} total={session.total} /></div></div></div>
        <CardContent className="p-5 sm:p-8"><div className="flex flex-wrap gap-2"><Badge tone={question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{question.type === "SINGLE_CHOICE" ? "单选题" : "多选题"}</Badge><Badge>{question.selectionSpec}</Badge><Badge tone="green">{question.levelCode}级</Badge><Badge>{question.knowledgeName}</Badge></div><h1 className="mt-6 text-xl font-extrabold leading-9 tracking-[-0.025em] sm:text-2xl">{question.stem}</h1><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{question.type === "MULTIPLE_CHOICE" ? `请选择 ${question.correctOptionCount} 项，全部正确才得分。` : "请选择一个最符合题意的答案。"}</p><div className="mt-7 flex flex-col gap-3">{question.options.map((option, optionIndex) => <AnswerOption key={option.id} index={optionIndex} option={option} selected={selectedSet.has(option.id)} disabled={Boolean(result)} correct={result?.correctOptionIds.includes(option.id)} wrongSelected={Boolean(result && result.selectedOptionIds.includes(option.id) && !result.correctOptionIds.includes(option.id))} onToggle={() => toggleOption(option.id)} />)}</div>{error ? <div role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">{error}</div> : null}{result ? <div className={cn("mt-5 flex items-start gap-3 rounded-2xl border p-4", result.isCorrect ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-rose-300/20 bg-rose-400/10 text-rose-200")}>{result.isCorrect ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <CircleX className="mt-0.5 size-5 shrink-0" />}<div><div className="font-extrabold">{result.isCorrect ? "回答正确" : "回答错误"}</div><div className="mt-1 text-sm leading-6">标准答案：{result.correctOptionIds.join("、")}。解析功能将在教师审核后开放。</div></div></div> : null}<div className="mt-7 hidden items-center justify-between gap-3 sm:flex"><Button variant="outline" onClick={() => moveTo(index - 1)} disabled={index === 0}><ArrowLeft className="size-4" />上一题</Button><span className="text-xs text-[var(--muted-foreground)]">数字键选择 · Enter 提交 · ← → 切题</span>{result ? completed ? <Button onClick={() => setSummaryVisible(true)}>查看结果<ArrowRight className="size-4" /></Button> : <Button onClick={() => moveTo(index + 1)}>下一题<ArrowRight className="size-4" /></Button> : <Button onClick={() => void submit()} disabled={pending}>{pending ? "提交中…" : "提交答案"}</Button>}</div></CardContent>
      </Card>
      <QuestionNavigator questions={session.questions} currentIndex={index} drafts={drafts} results={results} onSelect={moveTo} />
    </div>
    <div className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-[auto_1fr_auto] gap-2 rounded-2xl border border-[var(--border)] bg-[color:rgba(13,20,32,.97)] p-2 shadow-2xl backdrop-blur-xl sm:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}><Button variant="outline" size="sm" aria-label="移动端上一题" onClick={() => moveTo(index - 1)} disabled={index === 0}><ArrowLeft className="size-4" /></Button>{result ? completed ? <Button size="sm" aria-label="移动端查看结果" onClick={() => setSummaryVisible(true)}>查看结果</Button> : <Button size="sm" aria-label="移动端下一题" onClick={() => moveTo(index + 1)}>下一题</Button> : <Button size="sm" aria-label="移动端提交答案" onClick={() => void submit()} disabled={pending}>{pending ? "提交中…" : "提交答案"}</Button>}<Button variant="outline" size="sm" aria-label="移动端快速下一题" onClick={() => moveTo(index + 1)} disabled={index === session.questions.length - 1}><ArrowRight className="size-4" /></Button></div>
  </div>;
}
