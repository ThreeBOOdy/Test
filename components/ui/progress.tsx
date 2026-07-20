export function Progress({ value }: { value: number }) {
  return <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 p-[2px]" aria-label={`进度 ${value}%`}><div className="h-full rounded-full bg-[linear-gradient(90deg,#0a8b98,#21c4ca,#f1ae53)] shadow-[0_0_14px_rgba(33,196,202,.45)] transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
