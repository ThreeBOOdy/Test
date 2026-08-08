"use client";

/* eslint-disable @next/next/no-img-element -- 题目图片来自未知尺寸的动态二进制接口，原生 img 才能同时满足宽度自适应与等比缩放 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { splitImageMarkerText } from "@/lib/domain/question-image-marker";
import { cn } from "@/lib/utils";

export function QuestionRichText({ text, zoomable = false, className }: { text: string; zoomable?: boolean; className?: string }) {
  const [zoomImageId, setZoomImageId] = useState<string | null>(null);
  const segments = splitImageMarkerText(text);

  useEffect(() => {
    if (!zoomImageId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomImageId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomImageId]);

  return <>
    <span className={cn("whitespace-pre-line", className)}>
      {segments.map((segment, index) => segment.type === "text"
        ? <span key={index}>{segment.text}</span>
        : <img key={segment.imageId} src={`/api/v1/question-images/${segment.imageId}`} alt="题目图片" loading="lazy" className={cn("my-1 inline-block h-auto max-w-full rounded-lg align-middle", zoomable && "cursor-zoom-in")} onClick={zoomable ? (event) => { event.preventDefault(); event.stopPropagation(); setZoomImageId(segment.imageId); } : undefined} />)}
    </span>
    {zoomImageId ? <div role="dialog" aria-modal="true" aria-label="图片预览" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 sm:p-8" onClick={() => setZoomImageId(null)}>
      <button type="button" aria-label="关闭图片" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-white/10" onClick={(event) => { event.stopPropagation(); setZoomImageId(null); }}><X className="size-5" /></button>
      <img src={`/api/v1/question-images/${zoomImageId}`} alt="题目图片放大查看" className="max-h-full max-w-full cursor-zoom-out rounded-xl object-contain" onClick={(event) => { event.stopPropagation(); setZoomImageId(null); }} />
    </div> : null}
  </>;
}
