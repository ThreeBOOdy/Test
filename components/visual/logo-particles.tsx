"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

type LogoParticlesProps = {
  /** logo 图片地址(建议透明或浅色底, 深/红像素会被采样为粒子) */
  src: string;
  /** 无障碍名称 */
  label?: string;
  className?: string;
};

/**
 * Three.js 品牌粒子标志 (参考奖站/DSH 首页的粒子字标效果):
 * - 离屏采样 logo 像素: 红色吉祥物 → 红粒子, 黑色字形 → 墨粒子, 浅底自动忽略
 * - 入场: 粒子从四周散开位置聚合成 logo (逐粒延迟 + 弹簧回位)
 * - 常态: 微粒浮动呼吸; 鼠标靠近时粒子被拨开, 离开后弹性归位
 * - 尊重 prefers-reduced-motion, 离屏/切后台自动暂停, 卸载时完整释放 GPU 资源
 */
export function LogoParticles({ src, label = "品牌粒子标志", className }: LogoParticlesProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const setup = async () => {
      // ---------- 采样 logo 像素 ----------
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("logo image failed to load"));
        img.src = src;
      }).catch(() => null);
      if (!image || cancelled) return;

      const iw = image.naturalWidth;
      const ih = image.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = iw;
      canvas.height = ih;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, iw, ih).data;

      // 采样步长: 目标约 6~7 千粒子
      const step = Math.max(2, Math.round(Math.sqrt((iw * ih) / 26000)));
      const homes: number[] = [];
      const colors: number[] = [];
      const seeds: number[] = [];
      const ink = new THREE.Color("#181b20");
      for (let y = 0; y < ih; y += step) {
        for (let x = 0; x < iw; x += step) {
          const i = (y * iw + x) * 4;
          const a = data[i + 3];
          if (a < 110) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const isRed = r > 140 && g < 125 && b < 125;
          const isInk = lum < 96;
          if (!isRed && !isInk) continue; // 跳过浅蓝灰背景
          const jitter = 0.9 + ((x * 7 + y * 13) % 10) * 0.022;
          if (isRed) {
            colors.push(Math.min(1, (r / 255) * jitter), (g / 255) * jitter, (b / 255) * jitter);
          } else {
            colors.push(ink.r * jitter, ink.g * jitter, ink.b * jitter);
          }
          homes.push(x - iw / 2, ih / 2 - y, ((x * 31 + y * 17) % 100) / 100 * 10 - 5);
          seeds.push(((x * 73856093) ^ (y * 19349663)) % 1000 / 1000);
        }
      }
      const count = homes.length / 3;
      if (count < 40 || cancelled) return;

      try {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.display = "block";
        host.appendChild(renderer.domElement);
        setReady(true);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -600, 600);

        // ---------- 圆形粒子贴图 ----------
        const dotCanvas = document.createElement("canvas");
        dotCanvas.width = 64;
        dotCanvas.height = 64;
        const dotCtx = dotCanvas.getContext("2d");
        if (dotCtx) {
          const grad = dotCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
          grad.addColorStop(0, "rgba(255,255,255,1)");
          grad.addColorStop(0.72, "rgba(255,255,255,1)");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          dotCtx.fillStyle = grad;
          dotCtx.fillRect(0, 0, 64, 64);
        }
        const dotTexture = new THREE.CanvasTexture(dotCanvas);

        // ---------- 粒子缓冲 ----------
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const homeArr = new Float32Array(homes);
        const phaseArr = new Float32Array(count);
        const delayArr = new Float32Array(count);
        for (let i = 0; i < count; i += 1) {
          const seed = seeds[i];
          phaseArr[i] = seed * Math.PI * 2;
          delayArr[i] = 0.12 + seed * 0.9;
          const j = i * 3;
          if (reduced) {
            positions[j] = homeArr[j];
            positions[j + 1] = homeArr[j + 1];
            positions[j + 2] = homeArr[j + 2];
          } else {
            // 散开起点: 环绕 logo 的大椭圆 + 纵深
            const angle = seed * Math.PI * 2 + i * 0.13;
            const radius = 340 + ((i * 2654435761) % 1000) / 1000 * 520;
            positions[j] = homeArr[j] + Math.cos(angle) * radius;
            positions[j + 1] = homeArr[j + 1] + Math.sin(angle) * radius * 0.62;
            positions[j + 2] = ((i * 97) % 200) - 100;
          }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
        const material = new THREE.PointsMaterial({
          size: 3,
          vertexColors: true,
          map: dotTexture,
          alphaTest: 0.08,
          transparent: true,
          depthWrite: false,
          sizeAttenuation: false,
        });
        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // ---------- 视图适配 (正交相机 contain 适配 logo 比例) ----------
        const margin = 1.1;
        const logoAspect = iw / ih;
        let viewW = iw * margin;
        let viewH = ih * margin;
        const resize = () => {
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (w === 0 || h === 0) return;
          renderer.setSize(w, h, false);
          const hostAspect = w / h;
          if (hostAspect >= logoAspect) {
            viewH = ih * margin;
            viewW = viewH * hostAspect;
          } else {
            viewW = iw * margin;
            viewH = viewW / hostAspect;
          }
          camera.left = -viewW / 2;
          camera.right = viewW / 2;
          camera.top = viewH / 2;
          camera.bottom = -viewH / 2;
          camera.updateProjectionMatrix();
          // 世界步长 → 屏幕像素
          material.size = Math.max(1.6, (w / viewW) * step * 1.06);
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        resize();

        // ---------- 鼠标交互 (世界坐标排斥) ----------
        let mouseX = 99999;
        let mouseY = 99999;
        let mouseActive = false;
        const onPointerMove = (event: PointerEvent) => {
          const rect = host.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          mouseX = ((event.clientX - rect.left) / rect.width - 0.5) * viewW;
          mouseY = (0.5 - (event.clientY - rect.top) / rect.height) * viewH;
          mouseActive = true;
        };
        const onPointerLeave = () => { mouseActive = false; mouseX = 99999; mouseY = 99999; };
        host.addEventListener("pointermove", onPointerMove);
        host.addEventListener("pointerleave", onPointerLeave);

        // ---------- 动画循环 ----------
        const clock = new THREE.Clock();
        const SPRING = 0.024;
        const DAMPING = 0.875;
        const REPEL_RADIUS = Math.max(46, iw * 0.085);
        const REPEL_R2 = REPEL_RADIUS * REPEL_RADIUS;
        const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
        let raf = 0;
        let running = false;
        let visible = true;

        const frame = () => {
          raf = 0;
          const t = clock.getElapsedTime();
          for (let i = 0; i < count; i += 1) {
            if (t < delayArr[i]) continue; // 逐粒延迟入场
            const j = i * 3;
            const phase = phaseArr[i];
            // 常态呼吸浮动目标
            const hx = homeArr[j] + Math.sin(t * 0.7 + phase) * 1.15;
            const hy = homeArr[j + 1] + Math.cos(t * 0.85 + phase * 1.31) * 0.95;
            const hz = homeArr[j + 2];
            let vx = velocities[j];
            let vy = velocities[j + 1];
            let vz = velocities[j + 2];
            vx = (vx + (hx - positions[j]) * SPRING) * DAMPING;
            vy = (vy + (hy - positions[j + 1]) * SPRING) * DAMPING;
            vz = (vz + (hz - positions[j + 2]) * SPRING) * DAMPING;
            if (mouseActive) {
              const dx = positions[j] - mouseX;
              const dy = positions[j + 1] - mouseY;
              const d2 = dx * dx + dy * dy;
              if (d2 < REPEL_R2 && d2 > 0.01) {
                const d = Math.sqrt(d2);
                const force = (1 - d / REPEL_RADIUS) * 2.6;
                vx += (dx / d) * force;
                vy += (dy / d) * force;
              }
            }
            positions[j] += vx;
            positions[j + 1] += vy;
            positions[j + 2] += vz;
            velocities[j] = vx;
            velocities[j + 1] = vy;
            velocities[j + 2] = vz;
          }
          posAttr.needsUpdate = true;
          renderer.render(scene, camera);
          if (running) raf = requestAnimationFrame(frame);
        };

        const start = () => {
          if (running || !visible || document.hidden) return;
          running = true;
          clock.start();
          raf = requestAnimationFrame(frame);
        };
        const stop = () => {
          running = false;
          clock.stop();
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        };

        const io = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start(); else stop();
        }, { threshold: 0.05 });
        io.observe(host);
        const onVisibility = () => { if (document.hidden) stop(); else start(); };
        document.addEventListener("visibilitychange", onVisibility);

        if (reduced) {
          renderer.render(scene, camera); // 减少动态: 静态成形一帧
        } else {
          start();
        }

        cleanup = () => {
          stop();
          io.disconnect();
          ro.disconnect();
          document.removeEventListener("visibilitychange", onVisibility);
          host.removeEventListener("pointermove", onPointerMove);
          host.removeEventListener("pointerleave", onPointerLeave);
          geometry.dispose();
          material.dispose();
          dotTexture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        // 无 WebGL 环境(如测试/旧浏览器): 静默降级, 保留静态容器
      }
    };

    void setup();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [src]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      className={cn("relative w-full overflow-hidden", className)}
    >
      {/* 静态降级: 无 WebGL 或加载失败时保留原始 logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={cn(
          "absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-700",
          ready ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
}
