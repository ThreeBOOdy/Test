"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ScrambleTextProps = {
  /** 最终要“调谐”出的目标文本 */
  text: string;
  className?: string;
  /** 每个字符收敛所需的毫秒数基准 */
  duration?: number;
  /** 进入视口后延迟多少毫秒开始 */
  delay?: number;
  /** 扰码字符池, 默认无线电呼号风格 */
  chars?: string;
};

const DEFAULT_CHARS = "01·-/\\|+<>=~*^CQ73";

/**
 * 扰码调谐文本: 进入视口时字符从随机噪声逐位收敛为目标文本,
 * 呼应“把知识噪声调谐为清晰信号”的无线电隐喻。
 * SSR/首帧直接输出目标文本, 不影响可访问性与测试断言;
 * 无 IntersectionObserver 或偏好减少动态时保持静态。
 */
export function ScrambleText({ text, className, duration = 900, delay = 0, chars = DEFAULT_CHARS }: ScrambleTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [output, setOutput] = useState(text);
  const [tuning, setTuning] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver !== "function") return;

    let raf = 0;
    let timer = 0;
    const run = () => {
      const start = performance.now();
      const glyphs = Array.from(text);
      setTuning(true);
      const tick = (now: number) => {
        const elapsed = now - start;
        let done = true;
        const next = glyphs
          .map((glyph, index) => {
            if (glyph === " ") return glyph;
            // 每个字符有自己的收敛时刻, 靠前的字符先稳定
            const settle = (elapsed - (index / glyphs.length) * duration * 0.55) / (duration * 0.45);
            if (settle >= 1) return glyph;
            done = false;
            if (settle < 0) return chars[Math.floor(Math.random() * chars.length)];
            return Math.random() < settle ? glyph : chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
        setOutput(next);
        if (!done) {
          raf = requestAnimationFrame(tick);
        } else {
          setOutput(text);
          setTuning(false);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = window.setTimeout(run, delay);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [text, duration, delay, chars]);

  return (
    <span ref={ref} aria-label={text} className={cn("scramble-text", className)}>
      <span aria-hidden="true" className={cn(tuning && "scramble-text__glyph")}>{output}</span>
    </span>
  );
}
