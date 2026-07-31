import { NextResponse } from "next/server";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { getImportBatchReport } from "@/lib/server/import-service";
import { normalizePagination } from "@/lib/server/pagination";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTeacher();
    const { id } = await context.params;
    const url = new URL(request.url);
    const { page, pageSize } = normalizePagination({ page: url.searchParams.get("page") ?? undefined, pageSize: url.searchParams.get("pageSize") ?? undefined });
    return NextResponse.json(await getImportBatchReport(user.id, id, { page, pageSize, issuesOnly: url.searchParams.get("issuesOnly") === "true" }));
  } catch (error) {
    return apiErrorResponse(error, "读取导入报告失败");
  }
}
