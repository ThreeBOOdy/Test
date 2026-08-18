"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type SignalFieldProps = {
  className?: string;
  /** hero = 首页主视觉(全密度); ambient = 内页氛围(低密度、低存在感) */
  intensity?: "hero" | "ambient";
};

const CYAN = new THREE.Color("#0a8698");
const AMBER = new THREE.Color("#d18a2a");
const VIOLET = new THREE.Color("#7a6ce0");

/**
 * Three.js 无线电信号场:
 * - 起伏的粒子波面(模拟频谱/海面信号)
 * - 鼠标位置在波面上激起涟漪, 相机随之视差移动
 * - 远景缓慢旋转的天线环与巡航天线束
 * - 尊重 prefers-reduced-motion, 离屏/切后台自动暂停, 卸载时完整释放 GPU 资源
 */
export function SignalField({ className, intensity = "hero" }: SignalFieldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    try {
    const hero = intensity === "hero";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: hero ? "high-performance" : "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hero ? 1.75 : 1.25));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf6f7f4, 14, 38);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 5.8, 13.5);
    camera.lookAt(0, 0.4, 0);

    // ---------- 粒子波面 ----------
    const cols = hero ? 120 : 84;
    const rows = hero ? 64 : 44;
    const width = 52;
    const depth = 30;
    const count = cols * rows;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count); // 每颗粒子的相位种子, 让波动更自然

    let i3 = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = (c / (cols - 1) - 0.5) * width;
        const z = (r / (rows - 1) - 0.5) * depth;
        positions[i3] = x;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = z;
        const idx = i3 / 3;
        seeds[idx] = Math.sin(idx * 12.9898) * 43758.5453 % 1;
        // 约 14% 琥珀色、4% 紫色, 其余青色; 远稍暗近稍亮
        const pick = (idx * 7919) % 100;
        const base = pick < 14 ? AMBER : pick < 18 ? VIOLET : CYAN;
        const dim = 0.5 + 0.5 * (1 - r / rows);
        colors[i3] = base.r * dim;
        colors[i3 + 1] = base.g * dim;
        colors[i3 + 2] = base.b * dim;
        i3 += 3;
      }
    }

    const waveGeo = new THREE.BufferGeometry();
    waveGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    waveGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const waveMat = new THREE.PointsMaterial({
      size: hero ? 0.075 : 0.06,
      vertexColors: true,
      transparent: true,
      opacity: hero ? 0.55 : 0.32,
      blending: THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const wave = new THREE.Points(waveGeo, waveMat);
    wave.position.y = -1.4;
    scene.add(wave);

    // ---------- 天线环(远景慢速旋转) ----------
    const ringGroup = new THREE.Group();
    const ringDefs: { radius: number; tube: number; color: THREE.Color; opacity: number; tilt: number; speed: number }[] = [
      { radius: 3.1, tube: 0.012, color: CYAN, opacity: 0.4, tilt: 0.5, speed: 0.12 },
      { radius: 2.2, tube: 0.01, color: AMBER, opacity: 0.5, tilt: 1.1, speed: -0.18 },
      { radius: 4.2, tube: 0.008, color: VIOLET, opacity: 0.25, tilt: 0.2, speed: 0.07 },
    ];
    const rings: { mesh: THREE.Mesh; speed: number }[] = [];
    for (const def of ringDefs) {
      const geo = new THREE.TorusGeometry(def.radius, def.tube, 8, 128);
      const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: hero ? def.opacity : def.opacity * 0.45, blending: THREE.NormalBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2 + def.tilt * 0.35;
      mesh.rotation.y = def.tilt;
      ringGroup.add(mesh);
      rings.push({ mesh, speed: def.speed });
    }
    ringGroup.position.set(hero ? 8.6 : 10.5, 3.4, -8);
    scene.add(ringGroup);

    // 环心信标
    const beaconGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: hero ? 0.85 : 0.38, blending: THREE.NormalBlending, depthWrite: false });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    ringGroup.add(beacon);

    // ---------- 巡航扫描束(周期性扫过波面的光带) ----------
    const beamGeo = new THREE.PlaneGeometry(width, 0.9);
    const beamMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.y = -0.6;
    scene.add(beam);

    // ---------- 交互状态 ----------
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.4);
    const ndc = new THREE.Vector2(10, 10);
    const ripplePoint = new THREE.Vector3(999, 0, 999);
    let rippleStrength = 0;
    let camTargetX = 0;
    let camTargetY = 5.8;

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      camTargetX = ndc.x * (hero ? 1.5 : 0.6);
      camTargetY = 5.8 + ndc.y * (hero ? 0.9 : 0.4);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        ripplePoint.copy(hit);
        rippleStrength = Math.min(1, rippleStrength + 0.25);
      }
    };
    const onPointerLeave = () => {
      ndc.set(10, 10);
      camTargetX = 0;
      camTargetY = 5.8;
    };
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    // ---------- 尺寸自适应 ----------
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ---------- 波面位移 ----------
    const posAttr = waveGeo.getAttribute("position") as THREE.BufferAttribute;
    const displace = (t: number) => {
      for (let idx = 0; idx < count; idx += 1) {
        const j = idx * 3;
        const x = positions[j];
        const z = positions[j + 2];
        const seed = seeds[idx];
        let y =
          0.62 * Math.sin(x * 0.3 + t * 0.85 + seed * 2.1) * Math.cos(z * 0.26 + t * 0.55) +
          0.3 * Math.sin(x * 0.11 - t * 0.42 + z * 0.19 + seed * 5.0);
        // 鼠标涟漪: 以命中点为中心的高斯包络行波
        if (rippleStrength > 0.01) {
          const dx = x - ripplePoint.x;
          const dz = z - ripplePoint.z;
          const d2 = dx * dx + dz * dz;
          const d = Math.sqrt(d2);
          y += rippleStrength * 1.5 * Math.exp(-d2 * 0.06) * Math.sin(d * 1.5 - t * 4.2);
        }
        posAttr.setY(idx, y);
      }
      posAttr.needsUpdate = true;
    };

    // ---------- 渲染循环(可暂停) ----------
    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;
    let visible = true;

    const frame = () => {
      raf = 0;
      const t = clock.getElapsedTime();
      displace(t);
      rippleStrength *= 0.965;
      for (const { mesh, speed } of rings) mesh.rotation.z += speed * 0.016;
      ringGroup.rotation.y = Math.sin(t * 0.1) * 0.25;
      beacon.scale.setScalar(1 + 0.35 * Math.sin(t * 2.4));
      // 扫描束: 8 秒一个周期, 只在前 45% 时间内扫过
      const cycle = (t % 8) / 8;
      if (cycle < 0.45) {
        beam.visible = true;
        beam.position.z = depth / 2 - cycle / 0.45 * depth;
        beamMat.opacity = (hero ? 0.16 : 0.07) * Math.sin((cycle / 0.45) * Math.PI);
      } else {
        beam.visible = false;
      }
      camera.position.x += (camTargetX - camera.position.x) * 0.045;
      camera.position.y += (camTargetY - camera.position.y) * 0.045;
      camera.lookAt(0, 0.4, 0);
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
    }, { threshold: 0.02 });
    io.observe(host);
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      // 减少动态: 只渲染一帧静态画面
      displace(2.2);
      renderer.render(scene, camera);
    } else {
      start();
    }

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      waveGeo.dispose();
      waveMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      for (const { mesh } of rings) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
    } catch (error) {
      // WebGL 不可用(测试环境或浏览器禁用)时优雅降级, 不阻塞页面交互
      console.warn("SignalField: WebGL 初始化失败, 已降级为纯背景", error);
    }
  }, [intensity]);

  return <div ref={hostRef} aria-hidden="true" className={className} />;
}
