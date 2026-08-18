"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { StudentExplanation } from "@/lib/domain/student-explanation";
import { cn } from "@/lib/utils";

type StudentExplanationCardProps = {
  explanation?: StudentExplanation | null;
  /** 答错时由调用方传入 true，首次渲染即展开解析。 */
  autoExpand?: boolean;
  className?: string;
};

export function StudentExplanationCard({ explanation, autoExpand = false, className }: StudentExplanationCardProps) {
  const content = explanation && (explanation.summary || explanation.knowledge || explanation.memory) ? explanation : null;
  const [expanded, setExpanded] = useState(Boolean(content) && autoExpand);

  if (!content) {
    return (
      <div className={cn("mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--muted-foreground)]", className)} role="status">
        老师正在补充解析，请稍后再来看看。
      </div>
    );
  }

  return (
    <div className={cn("mt-5 overflow-hidden rounded-2xl border border-cyan-600/15 bg-cyan-500/[.05]", className)}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-cyan-800 transition hover:bg-cyan-500/[.06]"
      >
        <span className="flex items-center gap-2">
          <BookOpen className="size-4" />
          {expanded ? "收起解析" : "查看解析"}
        </span>
        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {expanded ? (
        <div className="space-y-4 border-t border-cyan-600/10 bg-[var(--surface)] px-4 py-4">
          {content.summary ? (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">一句话解析</h4>
              <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{content.summary}</p>
            </section>
          ) : null}
          {content.knowledge ? (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">知识点讲解</h4>
              <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{content.knowledge}</p>
            </section>
          ) : null}
          {content.memory ? (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">记忆点</h4>
              <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{content.memory}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
