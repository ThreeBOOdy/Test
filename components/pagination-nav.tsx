import Link from "next/link";

export function PaginationNav({ page, totalPages, path, params = {} }: { page: number; totalPages: number; path: string; params?: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    search.set("page", String(target));
    return `${path}?${search.toString()}`;
  };
  return <nav className="mt-6 flex items-center justify-center gap-3 text-sm"><Link aria-disabled={page <= 1} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 font-bold aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href(Math.max(1, page - 1)) as never}>上一页</Link><span className="text-[var(--muted-foreground)]">第 {page} / {totalPages} 页</span><Link aria-disabled={page >= totalPages} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 font-bold aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href(Math.min(totalPages, page + 1)) as never}>下一页</Link></nav>;
}
