export type PaginationInput = { page?: string | number; pageSize?: string | number };

export function normalizePagination(input: PaginationInput) {
  const rawPage = Number(input.page ?? 1);
  const rawPageSize = Number(input.pageSize ?? 20);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 20;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function createPageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
