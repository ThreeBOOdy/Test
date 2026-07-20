export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 flex items-center gap-2 text-[11px] font-black tracking-[0.2em] text-[var(--primary)]"><span className="size-1.5 rounded-full bg-[var(--primary)] signal-glow" />RADIO LEARNING CONSOLE</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>{action}</div>;
}
