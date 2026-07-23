import { Artwork } from "@/components/visual/artwork";

export function EmptySignalState({ title, description, action, compact = false }: { title: string; description: string; action?: React.ReactNode; compact?: boolean }) {
  return <div className="flex flex-col items-center justify-center p-7 text-center sm:p-10"><div className={compact ? "relative h-32 w-32 overflow-hidden rounded-3xl" : "relative h-48 w-48 overflow-hidden rounded-[2rem] sm:h-56 sm:w-56"}><Artwork src="/visuals/knowledge-signal.png" alt="无线电接收器暂未捕获信号" sizes={compact ? "160px" : "240px"} variant="empty" /></div><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 max-w-md text-sm leading-7 text-[var(--muted-foreground)]">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}
