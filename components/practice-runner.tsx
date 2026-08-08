"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleX, Clock3, Radio, Send } from "lucide-react";
import { AnswerOption } from "@/components/training/answer-option";
import { PracticeSummary } from "@/components/training/practice-summary";
import { QuestionNavigator } from "@/components/training/question-navigator";
import { QuestionRichText } from "@/components/question-rich-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpectrumProgress } from "@/components/visual/spectrum-progress";
import { getInitialQuestionIndex, toggleDraftSelection } from "@/lib/domain/practice-ui";
import type { PublicAnswerResult, PublicPracticeSession } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type ExamSubmitResult = { correctCount: number; total: number; passingCount: number; passed: boolean; settlementSource: "STUDENT_SUBMISSION" | "AUTO_SETTLEMENT"; completedAt: string; message?: string };

export function PracticeRunner({ session }: { session: PublicPracticeSession }) {
  const isExam = session.mode === "MOCK_EXAM";
  const initialDrafts = session.draft?.answers ?? {};
  const [index, setIndex] = useState(() => session.draft?.currentIndex ?? getInitialQuestionIndex(session.questions, session.initialResults));
  const [drafts, setDrafts] = useState<Record<string, string[]>>(initialDrafts);
  const [results, setResults] = useState<Record<string, PublicAnswerResult>>(session.initialResults);
  const [examResult, setExamResult] = useState(session.examResult);
  const [summaryVisible, setSummaryVisible] = useState(() => Boolean(session.examResult) || Object.keys(session.initialResults).length === session.questions.length);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() => session.exam ? Math.max(0, Math.ceil((new Date(session.exam.expiresAt).getTime() - Date.now()) / 1000)) : 0);
  const autoSubmitted = useRef(false);
  const answerRequestKeys = useRef<Record<string, string>>({});
  const draftVersion = useRef(session.draft?.version ?? 0);
  const draftAnswers = useRef<Record<string, string[]>>(initialDrafts);
  const pendingDraft = useRef<{ answers: Record<string, string[]>; currentIndex: number } | null>(null);
  const draftRequestInFlight = useRef(false);
  const draftRetryTimer = useRef<number | null>(null);
  const question = session.questions[index];
  const result = results[question.id];
  const selected = useMemo(() => result?.selectedOptionIds ?? drafts[question.id] ?? [], [drafts, question.id, result?.selectedOptionIds]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const answeredCount = Object.keys(results).length;
  const draftedCount = Object.values(drafts).filter((answer) => answer.length > 0).length;
  const completed = answeredCount === session.questions.length;
  const correctCount = Object.values(results).filter((item) => item.isCorrect).length;

  const moveTo = useCallback((nextIndex: number) => {
    const boundedIndex = Math.min(session.questions.length - 1, Math.max(0, nextIndex));
    setIndex(boundedIndex);
    setError("");
  }, [session.questions.length]);

  const flushDraftSave = useCallback(async () => {
    if (!isExam || draftRequestInFlight.current || !pendingDraft.current || summaryVisible) return;
    draftRequestInFlight.current = true;
    const payload = pendingDraft.current;
    pendingDraft.current = null;
    try {
      const response = await fetch(`/api/v1/practice-sessions/${session.id}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, version: draftVersion.current }) });
      const data = await response.json() as { version?: number; message?: string };
      if (!response.ok) {
        if (response.status === 409) setError(data.message ?? "考试草稿已被更新，请刷新页面恢复最新内容");
        else { pendingDraft.current = payload; setError(data.message ?? "草稿保存失败，正在重试"); }
        return;
      }
      draftVersion.current = data.version ?? draftVersion.current + 1;
    } catch {
      pendingDraft.current = payload;
      setError("网络暂时不可用，草稿正在自动重试");
    } finally {
      draftRequestInFlight.current = false;
      if (pendingDraft.current && !summaryVisible && draftRetryTimer.current === null) {
        draftRetryTimer.current = window.setTimeout(() => { draftRetryTimer.current = null; void flushDraftSave(); }, 1000);
      }
    }
  }, [isExam, session.id, summaryVisible]);

  useEffect(() => {
    if (!isExam || summaryVisible) return;
    pendingDraft.current = { answers: draftAnswers.current, currentIndex: index };
    void flushDraftSave();
  }, [flushDraftSave, index, isExam, summaryVisible]);

  const queueDraftSave = useCallback((answers: Record<string, string[]>, currentIndex: number) => {
    if (!isExam || summaryVisible) return;
    draftAnswers.current = answers;
    pendingDraft.current = { answers, currentIndex };
    void flushDraftSave();
  }, [flushDraftSave, isExam, summaryVisible]);

  const toggleOption = useCallback((optionId: string) => {
    if (result || pending) return;
    setError("");
    setDrafts((current) => {
      const next = { ...current, [question.id]: toggleDraftSelection(current[question.id] ?? [], optionId, question.type) };
      if (isExam) queueDraftSave(next, index);
      return next;
    });
  }, [index, isExam, pending, queueDraftSave, question.id, question.type, result]);

  const submitAnswer = useCallback(async () => {
    if (isExam || result || pending) return;
    if (!selected.length) { setError("请先选择答案"); return; }
    const idempotencyKey = answerRequestKeys.current[question.id] ?? crypto.randomUUID();
    answerRequestKeys.current[question.id] = idempotencyKey;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/v1/practice-sessions/${session.id}/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id, selectedOptionIds: selected, idempotencyKey }) });
      const data = await response.json() as PublicAnswerResult & { message?: string };
      if (!response.ok) { setError(data.message ?? "提交失败，请稍后重试"); return; }
      setResults((current) => ({ ...current, [question.id]: data }));
      setDrafts((current) => { const next = { ...current }; delete next[question.id]; return next; });
    } catch { setError("提交失败，请稍后重试"); }
    finally { setPending(false); }
  }, [isExam, pending, question.id, result, selected, session.id]);

  const submitExam = useCallback(async () => {
    if (!isExam || pending || summaryVisible) return;
    setPending(true); setError("");
    try {
      const answers = session.questions.map((item) => ({ questionId: item.id, selectedOptionIds: draftAnswers.current[item.id] ?? [] }));
      const response = await fetch(`/api/v1/practice-sessions/${session.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const data = await response.json() as ExamSubmitResult;
      if (!response.ok) { setError(data.message ?? "交卷失败，请稍后重试"); return; }
      setExamResult(data);
      setSummaryVisible(true);
    } catch { setError("交卷失败，请稍后重试"); }
    finally { setPending(false); }
  }, [isExam, pending, session.id, session.questions, summaryVisible]);

  const abandonExam = useCallback(async () => {
    if (!isExam || pending || summaryVisible) return;
    setPending(true);
    try {
      await fetch(`/api/v1/practice-sessions/${session.id}/abandon`, { method: "POST" });
    } finally {
      window.location.href = "/student";
    }
  }, [isExam, pending, session.id, summaryVisible]);

  useEffect(() => {
    if (!isExam || summaryVisible) return;
    const persistOnHide = () => {
      if (document.visibilityState !== "hidden" || !pendingDraft.current || draftRequestInFlight.current) return;
      const payload = pendingDraft.current;
      pendingDraft.current = null;
      void fetch(`/api/v1/practice-sessions/${session.id}/draft`, { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, version: draftVersion.current }) });
    };
    document.addEventListener("visibilitychange", persistOnHide);
    window.addEventListener("pagehide", persistOnHide);
    return () => { document.removeEventListener("visibilitychange", persistOnHide); window.removeEventListener("pagehide", persistOnHide); };
  }, [isExam, session.id, summaryVisible]);

  useEffect(() => {
    if (!session.exam || summaryVisible) return;
    const timer = window.setInterval(() => setRemainingSeconds(Math.max(0, Math.ceil((new Date(session.exam!.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [session.exam, summaryVisible]);

  useEffect(() => {
    if (!isExam || remainingSeconds > 0 || summaryVisible || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submitExam();
  }, [isExam, remainingSeconds, submitExam, summaryVisible]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      if (/^[1-9]$/.test(event.key) && !result) {
        const option = question.options[Number(event.key) - 1];
        if (option) { event.preventDefault(); toggleOption(option.id); }
        return;
      }
      if (event.key === "Enter" && !isExam) {
        event.preventDefault();
        if (!result) void submitAnswer();
        else if (completed) setSummaryVisible(true);
        else moveTo(index + 1);
        return;
      }
      if (event.key === "ArrowLeft") { event.preventDefault(); moveTo(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); moveTo(index + 1); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, index, isExam, moveTo, question.options, result, submitAnswer, toggleOption]);

  const studentFacingTitle = isExam ? "模拟考试" : "当前练习";

  if (summaryVisible) return <PracticeSummary title={studentFacingTitle} correct={isExam ? examResult?.correctCount ?? 0 : correctCount} total={isExam ? examResult?.total ?? session.total : session.total} passingCount={isExam ? examResult?.passingCount : session.exam?.passingCount} settlementSource={isExam ? examResult?.settlementSource : undefined} />;

  const progressCount = isExam ? draftedCount : answeredCount;
  return <div className="practice-reading safe-bottom mx-auto max-w-7xl">
    <div className="mb-5 flex items-center justify-between gap-4">{isExam ? <button type="button" onClick={() => void abandonExam()} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[.04] hover:text-slate-100"><ArrowLeft className="size-4" />放弃考试</button> : <Link href="/student" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[.04] hover:text-slate-100"><ArrowLeft className="size-4" />退出训练</Link>}<div className={cn("flex items-center gap-2 rounded-full border border-white/8 bg-white/[.035] px-3 py-2 text-sm font-semibold", isExam && remainingSeconds <= 300 ? "text-rose-300" : "text-cyan-100/75")}><Clock3 className="size-4" />{isExam ? `剩余 ${formatDuration(remainingSeconds)}` : "训练频道已连接"}</div></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card variant="receiver" className="practice-console overflow-hidden text-slate-50"><div className="border-b border-cyan-200/10 bg-[#08121e]/95 px-5 py-5 sm:px-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-radio flex items-center gap-2 text-[10px] font-bold tracking-[.14em] text-cyan-300"><Radio className="size-3.5" />{studentFacingTitle}</div><div className="mt-1.5 text-base font-bold text-slate-100">第 {index + 1} / {session.total} 题</div></div><div className="w-full sm:max-w-64"><div className="font-radio mb-2 flex justify-between text-[10px] text-slate-400"><span>{isExam ? "答题进度" : "训练进度"}</span><span>{progressCount} / {session.total}</span></div><SpectrumProgress answered={progressCount} total={session.total} /></div></div></div>
        <CardContent className="bg-[linear-gradient(145deg,rgba(13,27,42,.98),rgba(7,15,25,.98))] p-5 sm:p-8"><div className="rounded-2xl border border-cyan-200/10 bg-black/10 p-4 sm:p-5"><div className="font-radio text-[10px] font-bold tracking-[.14em] text-amber-300/80">QUESTION {String(index + 1).padStart(2, "0")}</div><h1 className="practice-question mt-3 text-[1.35rem] font-bold leading-[1.75] text-white sm:text-[1.7rem]"><QuestionRichText text={question.stem} zoomable /></h1><p className="mt-3 text-sm leading-7 text-slate-400">请选择你认为正确的答案。</p></div><div className="mt-5 flex flex-col gap-3">{question.options.map((option, optionIndex) => <AnswerOption key={option.id} index={optionIndex} option={option} type={question.type} selected={selectedSet.has(option.id)} disabled={Boolean(result)} correct={result?.correctOptionIds.includes(option.id)} wrongSelected={Boolean(result && result.selectedOptionIds.includes(option.id) && !result.correctOptionIds.includes(option.id))} onToggle={() => toggleOption(option.id)} />)}</div>{error ? <div role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">{error}</div> : null}{result && !isExam ? <div className={cn("mt-5 flex items-start gap-3 rounded-2xl border p-4", result.isCorrect ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-rose-300/20 bg-rose-400/10 text-rose-100")}>{result.isCorrect ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <CircleX className="mt-0.5 size-5 shrink-0" />}<div><div className="font-bold">{result.isCorrect ? "回答正确" : "回答错误"}</div><div className="mt-1 text-sm leading-6">标准答案：{result.correctOptionIds.join("、")}</div></div></div> : null}<div className="mt-7 hidden items-center justify-between gap-3 border-t border-white/[.07] pt-5 sm:flex"><Button variant="outline" onClick={() => moveTo(index - 1)} disabled={index === 0}><ArrowLeft className="size-4" />上一题</Button><span className="font-radio text-[10px] text-slate-500">数字键选择 · ← → 切题</span>{isExam ? index === session.total - 1 ? <Button onClick={() => void submitExam()} disabled={pending}><Send className="size-4" />{pending ? "交卷中…" : "提交试卷"}</Button> : <Button onClick={() => moveTo(index + 1)}>下一题<ArrowRight className="size-4" /></Button> : result ? completed ? <Button onClick={() => setSummaryVisible(true)}>查看结果<ArrowRight className="size-4" /></Button> : <Button onClick={() => moveTo(index + 1)}>下一题<ArrowRight className="size-4" /></Button> : <Button onClick={() => void submitAnswer()} disabled={pending}>{pending ? "提交中…" : "提交答案"}</Button>}</div></CardContent>
      </Card>
      <QuestionNavigator questions={session.questions} currentIndex={index} drafts={drafts} results={results} onSelect={moveTo} />
    </div>
    <div className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-[auto_1fr_auto] gap-2 rounded-2xl border border-cyan-300/15 bg-[rgba(5,11,18,.94)] p-2 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:hidden"><Button variant="outline" onClick={() => moveTo(index - 1)} disabled={index === 0} aria-label="上一题"><ArrowLeft className="size-4" /></Button>{isExam && index === session.total - 1 ? <Button onClick={() => void submitExam()} disabled={pending}>{pending ? "交卷中…" : "提交试卷"}</Button> : !isExam && !result ? <Button onClick={() => void submitAnswer()} disabled={pending}>{pending ? "提交中…" : "提交答案"}</Button> : <Button onClick={() => completed && !isExam ? setSummaryVisible(true) : moveTo(index + 1)} disabled={!completed && index === session.total - 1}>{completed && !isExam ? "查看结果" : "下一题"}</Button>}<Button variant="outline" onClick={() => moveTo(index + 1)} disabled={index === session.total - 1} aria-label="下一题"><ArrowRight className="size-4" /></Button></div>
  </div>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
