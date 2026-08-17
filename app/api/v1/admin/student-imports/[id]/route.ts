import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { getStudentImport } from "@/lib/server/student-import-service";

function pageOptions(request: Request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page");
  const pageSize = url.searchParams.get("pageSize");
  return {
    ...(page === null ? {} : { page: Number(page) }),
    ...(pageSize === null ? {} : { pageSize: Number(pageSize) }),
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const administrator = await requireAdministrator();
    const { id } = await context.params;
    return NextResponse.json(await getStudentImport(administrator.id, id, pageOptions(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "读取导入草稿失败");
  }
}
