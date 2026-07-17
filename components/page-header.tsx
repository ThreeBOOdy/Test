export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>{action}</div>;
}
