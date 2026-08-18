"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type MagneticProps = {
  children: React.ReactNode;
  className?: string;
  /** 吸附强度 0-1, 越大跟随越明显 */
  strength?: number;
};

/** 磁吸包装器: 指针靠近时内容向指针方向轻微吸附, 离开时弹性归位(触屏自动禁用) */
export function Magnetic({ children, className, strength = 0.32 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const frame = useRef(0);

  const handleMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner || event.pointerType === "touch") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      inner.style.transform = `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`;
    });
  };

  const handleLeave = () => {
    const inner = innerRef.current;
    cancelAnimationFrame(frame.current);
    if (inner) inner.style.transform = "";
  };

  return (
    <span ref={ref} onPointerMove={handleMove} onPointerLeave={handleLeave} className={cn("magnetic", className)}>
      <span ref={innerRef} className="magnetic__inner">{children}</span>
    </span>
  );
}
