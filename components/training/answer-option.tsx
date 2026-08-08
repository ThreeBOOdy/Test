import { Check, X } from "lucide-react";
import { QuestionRichText } from "@/components/question-rich-text";
import type { QuestionType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function AnswerOption({ index, option, type, selected, disabled, correct, wrongSelected, onToggle }: { index: number; option: { id: string; text: string }; type: QuestionType; selected: boolean; disabled: boolean; correct?: boolean; wrongSelected?: boolean; onToggle: () => void }) {
  const multiple = type === "MULTIPLE_CHOICE";
  return <label className={cn("group flex min-h-[4.75rem] w-full cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3.5 text-left text-slate-100 shadow-[inset_0_1px_rgba(255,255,255,.025)] transition-[border-color,background-color,box-shadow,transform] duration-200", disabled && "cursor-default", !correct && !wrongSelected && selected && "border-cyan-300/65 bg-cyan-300/[.13] shadow-[0_0_0_1px_rgba(92,225,230,.08),0_12px_32px_rgba(0,0,0,.18)]", !correct && !wrongSelected && !selected && "border-slate-600/45 bg-[#101d2b] hover:-translate-y-px hover:border-cyan-200/35 hover:bg-[#142438]", correct && "border-emerald-300/55 bg-emerald-400/[.13]", wrongSelected && "border-rose-300/55 bg-rose-400/[.13]")}>
    <input type={multiple ? "checkbox" : "radio"} name="practice-answer" checked={selected} disabled={disabled} onChange={onToggle} className="sr-only" />
    <span aria-hidden="true" className={cn("font-radio grid size-9 shrink-0 place-items-center border text-xs font-bold text-slate-400", multiple ? "rounded-lg" : "rounded-full", !selected && !correct && !wrongSelected && "border-slate-500/60 bg-black/20 group-hover:border-cyan-200/50 group-hover:text-cyan-100", selected && "border-cyan-200 bg-cyan-300 text-slate-950", correct && "border-emerald-200 bg-emerald-300 text-slate-950", wrongSelected && "border-rose-200 bg-rose-300 text-slate-950")}>
      {correct ? <Check className="size-4" /> : wrongSelected ? <X className="size-4" /> : selected ? <Check className="size-4" /> : option.id}
    </span>
    <QuestionRichText text={option.text} zoomable className="min-w-0 flex-1 text-[1.02rem] font-medium leading-8 text-slate-100 sm:text-[1.08rem]" />
    <span className="font-radio rounded-md border border-white/[.06] bg-black/15 px-2 py-1 text-[10px] font-bold text-slate-500">{index + 1}</span>
  </label>;
}
