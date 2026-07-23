export function PageHeader({ title, description, action, eyebrow = "SIGNAL CONSOLE" }: { title: string; description: string; action?: React.ReactNode; eyebrow?: string }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 text-[10px] font-bold tracking-[.22em] text-[var(--primary)]">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}
