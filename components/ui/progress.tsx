export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--secondary)]" aria-label={`进度 ${value}%`}>
      <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
