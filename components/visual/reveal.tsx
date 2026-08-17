"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** 入场延迟(ms), 用于同级元素阶梯式显现 */
  delay?: number;
  /** 从哪个方向浮入 */
  from?: "up" | "left" | "right" | "scale";
};

/** 滚动进入视口时平滑显现的容器(IntersectionObserver, 只触发一次) */
export function Reveal({ children, className, delay = 0, from = "up" }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // 偏好减少动态时直接以“已显现”为初始状态, 跳过低效动画
  const [shown, setShown] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={cn("reveal", `reveal--from-${from}`, shown && "reveal--shown", className)}
    >
      {children}
    </div>
  );
}
