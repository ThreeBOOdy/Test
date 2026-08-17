"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  /** 最大倾角(度) */
  max?: number;
};

/** 鼠标驱动的 3D 透视倾斜卡片, 带高光跟随 */
export function TiltCard({ children, className, max = 5 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || event.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1100px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
      el.style.setProperty("--tilt-glow-x", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--tilt-glow-y", `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.transform = "";
  };

  return (
    <div ref={ref} onPointerMove={handleMove} onPointerLeave={handleLeave} className={cn("tilt-card", className)}>
      {children}
    </div>
  );
}
