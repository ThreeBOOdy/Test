export function PageHeader({ title, description, action, eyebrow = "SIGNAL CONSOLE" }: { title: string; description: string; action?: React.ReactNode; eyebrow?: string }) {
  return <div className="mb-7 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><div className="eyebrow-radio mb-2 flex items-center gap-2"><span className="status-dot" />{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}
