"use client";

import { useState } from "react";
import Image from "next/image";
import { CircleCheck, Orbit, RadioTower, SatelliteDish, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

type ArtworkVariant = "orbital" | "antenna" | "spectrum" | "empty" | "complete";

const icons = {
  orbital: Orbit,
  antenna: SatelliteDish,
  spectrum: Waves,
  empty: RadioTower,
  complete: CircleCheck,
};

export function Artwork({ src, alt, sizes, preload = false, variant, className }: { src: string; alt: string; sizes: string; preload?: boolean; variant: ArtworkVariant; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Icon = icons[variant];

  return <div className={cn("absolute inset-0 overflow-hidden bg-[#09111c]", className)}>
    {!failed ? <Image src={src} alt={alt} fill preload={preload} loading={preload ? "eager" : "lazy"} sizes={sizes} className="object-cover" onError={() => setFailed(true)} /> : <div role="img" aria-label={alt} className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_65%_35%,rgba(85,215,232,.18),transparent_28%),radial-gradient(circle_at_35%_70%,rgba(141,124,247,.14),transparent_30%),linear-gradient(145deg,#07101a,#101b2b)]"><div className="tech-grid absolute inset-0 opacity-80" /><div className="absolute size-[70%] rounded-full border border-cyan-300/10" /><div className="absolute size-[45%] rounded-full border border-violet-300/10" /><div className="relative grid size-24 place-items-center rounded-[2rem] border border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)] shadow-[0_0_80px_rgba(85,215,232,.12)]"><Icon className="size-11" /></div></div>}
  </div>;
}
