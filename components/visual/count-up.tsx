"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CountUpProps = {
  to: number;
  className?: string;
  /** 滚动进入视口后的计数时长(ms) */
  duration?: number;
  suffix?: string;
  prefix?: string;
};

/** 数字滚动计数: 进入视口后以 easeOutExpo 曲线计数到目标值(表格数字等宽字体) */
export function CountUp({ to, className, duration = 1600, suffix = "", prefix = "" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver !== "function") return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        // 即将进入视口时归零并异步启动计数(回调内 setState, 不占首帧)
        setValue(0);
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          setValue(Math.round(to * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4, rootMargin: "0px 0px 8% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className={cn("stat-number font-radio", className)}>
      {prefix}{value}{suffix}
    </span>
  );
}
