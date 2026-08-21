"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type WrongClearButtonProps = {
  apiPath: string;
  count?: number;
  buttonLabel?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  successMessage?: string;
  className?: string;
};

export function WrongClearButton({
  apiPath,
  count,
  buttonLabel = "一键清除错题",
  confirmTitle = "确认清除全部错题？",
  confirmDescription,
  successMessage = "错题已清除",
  className,
}: WrongClearButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function clear() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "清除错题失败，请稍后重试");
        return;
      }
      setMessage(`${successMessage}${result.cleared != null ? `（${result.cleared} 道）` : ""}`);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("清除错题失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div role="alertdialog" aria-label={confirmTitle} className="flex flex-col gap-3 rounded-2xl border border-rose-300/60 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-700" />
          <div>
            <div className="font-extrabold text-rose-800">{confirmTitle}</div>
            <div className="mt-1 text-sm leading-6 text-rose-700">
              {confirmDescription ?? (count != null ? `将清除当前字母类下 ${count} 道错题的答题记录、FSRS 与统计，收藏/忽略标记会保留。` : "将清除当前字母类下全部错题的答题记录、FSRS 与统计，收藏/忽略标记会保留。")}
            </div>
            {error ? <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { setConfirming(false); setError(""); }} disabled={pending}>
            取消
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={() => void clear()} disabled={pending}>
            {pending ? <Loader2 className="size-3 animate-spin" /> : <Eraser className="size-3" />}
            确认清除
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button type="button" variant="danger" size="sm" onClick={() => setConfirming(true)}>
        <Eraser className="size-3" />
        {buttonLabel}
      </Button>
      {message ? <p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
