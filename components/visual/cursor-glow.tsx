"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/** 仅在精细指针(鼠标)且未偏好减少动态时启用; SSR 快照固定为 false, 避免水合不一致 */
function useCursorEnvironment() {
  return useSyncExternalStore(
    (onChange) => {
      const pointerMq = window.matchMedia("(pointer: fine)");
      const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
      pointerMq.addEventListener("change", onChange);
      motionMq.addEventListener("change", onChange);
      return () => {
        pointerMq.removeEventListener("change", onChange);
        motionMq.removeEventListener("change", onChange);
      };
    },
    () => window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * 奖项站风格的跟随光标系统: 屏幕混合模式的信号光斑 + 阻尼圆环 + 精确定位点。
 * 悬停在链接/按钮上时圆环放大并切换为琥珀色(“捕获信号”)。
 * 仅在精细指针(鼠标)设备且未偏好减少动态时渲染; 滚动进度条同步输出。
 */
export function CursorGlow({ progress = false }: { progress?: boolean }) {
  const blobRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const enabled = useCursorEnvironment();

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const target = { x: -100, y: -100 };
    const ring = { x: -100, y: -100 };
    const blob = { x: -100, y: -100 };

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      const hot = event.target instanceof Element && event.target.closest("a, button, [role='button']");
      ringRef.current?.classList.toggle("is-hot", Boolean(hot));
    };

    const loop = () => {
      // 三级阻尼: 光斑最慢(氛围), 圆环居中(韵律), 光点即时(精确)
      blob.x += (target.x - blob.x) * 0.055;
      blob.y += (target.y - blob.y) * 0.055;
      ring.x += (target.x - ring.x) * 0.16;
      ring.y += (target.y - ring.y) * 0.16;
      if (blobRef.current) blobRef.current.style.transform = `translate3d(${blob.x}px, ${blob.y}px, 0)`;
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    const onScroll = () => {
      const bar = barRef.current;
      if (!bar) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    if (progress) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [enabled, progress]);

  if (!enabled) return null;
  return (
    <>
      <div ref={blobRef} aria-hidden="true" className="cursor-glow__blob" />
      <div ref={ringRef} aria-hidden="true" className="cursor-glow__ring" />
      <div ref={dotRef} aria-hidden="true" className="cursor-glow__dot" />
      {progress ? <div ref={barRef} aria-hidden="true" className="scroll-progress" /> : null}
    </>
  );
}
