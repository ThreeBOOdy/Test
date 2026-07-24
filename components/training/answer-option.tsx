import { Check, X } from "lucide-react";
import type { QuestionType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function AnswerOption({ index, option, type, selected, disabled, correct, wrongSelected, onToggle }: { index: number; option: { id: string; text: string }; type: QuestionType; selected: boolean; disabled: boolean; correct?: boolean; wrongSelected?: boolean; onToggle: () => void }) {
  const multiple = type === "MULTIPLE_CHOICE";
  return <label className={cn("flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-colors", disabled && "cursor-default", !correct && !wrongSelected && selected && "border-cyan-300/50 bg-cyan-300/10", !correct && !wrongSelected && !selected && "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--border-strong)]", correct && "border-emerald-300/45 bg-emerald-400/10", wrongSelected && "border-rose-300/45 bg-rose-400/10")}>
    <input type={multiple ? "checkbox" : "radio"} name="practice-answer" checked={selected} disabled={disabled} onChange={onToggle} className="sr-only" />
    <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center border-2 border-current/45 bg-black/10", multiple ? "rounded-md" : "rounded-full", selected && "border-cyan-300 bg-cyan-300 text-slate-950", correct && "border-emerald-300 bg-emerald-300 text-slate-950", wrongSelected && "border-rose-300 bg-rose-300 text-slate-950")}>
      {correct ? <Check className="size-4" /> : wrongSelected ? <X className="size-4" /> : selected ? <Check className="size-4" /> : null}
    </span>
    <span className="min-w-0 flex-1 font-semibold leading-7">{option.text}</span>
    <span className="text-xs font-bold text-[var(--muted-foreground)]">{index + 1}</span>
  </label>;
}
