import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AiTutorChat } from "@/components/training/ai-tutor-chat";
import { Artwork } from "@/components/visual/artwork";

export function PracticeSummary({
  title,
  correct,
  total,
  passingCount,
  settlementSource,
  wrongQuestions = [],
  sessionId,
}: {
  title: string;
  correct: number;
  total: number;
  passingCount?: number;
  settlementSource?: "STUDENT_SUBMISSION" | "AUTO_SETTLEMENT";
  wrongQuestions?: Array<{ id: string; stem: string }>;
  sessionId?: string;
}) {
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  const passed = passingCount === undefined ? undefined : correct >= passingCount;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid min-h-[76vh] items-center">
        <div className="grid overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] md:grid-cols-[.8fr_1.2fr]">
          <div className="relative min-h-64 bg-[var(--surface-soft)]">
            <Artwork src="/art/training-complete.webp" alt="无线电信号完成校准" sizes="(max-width: 768px) 100vw, 40vw" variant="complete" />
          </div>
          <div className="p-7 sm:p-10">
            <div className="text-xs font-bold uppercase tracking-[.22em] text-[var(--primary)]">Calibration complete</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-[-0.04em]">{passingCount === undefined ? "训练完成" : "模拟考试完成"}</h1>
              {passed !== undefined ? <Badge tone={passed ? "green" : "red"}>{passed ? "考试合格" : "未达合格线"}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{title}</p>
            {settlementSource ? <p className="mt-2 text-sm font-semibold text-[var(--muted-foreground)]">结算来源：{settlementSource === "AUTO_SETTLEMENT" ? "自动结算" : "主动交卷"}</p> : null}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {passingCount === undefined ? (
                <>
                  <Metric label="正确" value={`${correct}`} />
                  <Metric label="总题" value={`${total}`} />
                  <Metric label="正确率" value={`${accuracy}%`} />
                </>
              ) : (
                <>
                  <Metric label="答对题" value={`${correct}/${total}`} />
                  <Metric label="合格线" value={`${passingCount}`} />
                  <Metric label="结果" value={passed ? "合格" : "未合格"} />
                </>
              )}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/student" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)]">返回训练首页</Link>
              <Link href="/student/history" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 text-sm font-bold">查看练习记录</Link>
            </div>
          </div>
        </div>
      </div>
      {wrongQuestions.length > 0 ? (
        <section className="pb-10">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-[.22em] text-[var(--primary)]">AI Socratic Tutor</div>
            <h2 className="mt-1 text-xl font-extrabold">错题 AI 答疑</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">针对答错的题目向 AI 教练提问；首次回复只给提示，追问后可以得到完整解析。</p>
          </div>
          <div className="space-y-4">
            {wrongQuestions.map((question) => (
              <Card key={question.id}>
                <CardContent>
                  <div className="text-sm font-bold leading-6">{question.stem}</div>
                  <AiTutorChat questionId={question.id} questionStem={question.stem} sessionId={sessionId} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[var(--surface-soft)] p-4 text-center"><div className="stat-number text-2xl font-black">{value}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</div></div>;
}
