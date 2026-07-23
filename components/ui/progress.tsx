export function Progress({ value }: { value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  return <div className="h-2 overflow-hidden rounded-full bg-[var(--secondary)]" role="progressbar" aria-label={`进度 ${clampedValue}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clampedValue}><div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${clampedValue}%` }} /></div>;
}
