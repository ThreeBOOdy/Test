import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { AiExplanationReviewManager } from "@/components/ai-explanation-review-manager";
import { listExplanationReviews } from "@/lib/server/ai/explanation-review";
import { prisma } from "@/lib/db";

const STATUS_TABS = [
  { value: "DRAFT", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "ALL", label: "全部" },
] as const;

export default async function AiExplanationsPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; status?: string; search?: string; levelId?: string }> }) {
  const params = await searchParams;
  const currentStatus = params.status && STATUS_TABS.some((tab) => tab.value === params.status) ? params.status : "DRAFT";
  const result = await listExplanationReviews({
    page: params.page,
    pageSize: params.pageSize,
    status: currentStatus,
    search: params.search,
    levelId: params.levelId,
  });
  const levels = await prisma.level.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });

  return (
    <AppShell role="teacher" currentPath="/teacher/ai-explanations">
      <div className="safe-bottom">
        <PageHeader title="AI 解析审核" description={`共 ${result.total} 条解析记录，当前第 ${result.page} 页。AI 草稿需教师审核后才会对学生可见。`} />
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/teacher/ai-explanations?status=${tab.value}${params.search ? `&search=${encodeURIComponent(params.search)}` : ""}${params.levelId ? `&levelId=${encodeURIComponent(params.levelId)}` : ""}` as never}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition ${currentStatus === tab.value ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <form method="get" className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:grid-cols-[1fr_180px_auto]">
            <input type="hidden" name="status" value={currentStatus} />
            <label className="flex h-11 items-center gap-3 rounded-xl bg-[var(--muted)] px-4">
              <input name="search" defaultValue={params.search ?? ""} className="w-full bg-transparent text-sm outline-none" placeholder="搜索题干或题目编号" />
            </label>
            <select name="levelId" defaultValue={params.levelId ?? ""} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none">
              <option value="">全部等级</option>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.code}级 · {level.name}</option>)}
            </select>
            <button type="submit" className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 text-sm font-bold hover:border-[var(--border-strong)]">筛选</button>
          </form>
        </div>
        <AiExplanationReviewManager rows={result.items} />
        <PaginationNav page={result.page} totalPages={result.totalPages} path="/teacher/ai-explanations" params={{ status: currentStatus, search: params.search, levelId: params.levelId }} />
      </div>
    </AppShell>
  );
}
