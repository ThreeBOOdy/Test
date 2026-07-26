import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { listStudents } from "@/lib/server/student-account-service";

export async function GET(request: Request) {
  try {
    await requireAdministrator();
    const url = new URL(request.url);
    return NextResponse.json({ items: await listStudents({ search: url.searchParams.get("search") ?? undefined, status: (url.searchParams.get("status") || undefined) as never }) });
  } catch (error) { return apiErrorResponse(error, "读取学生账号失败"); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireAdministrator();
    return NextResponse.json({ message: "请使用学生 Excel 导入创建账号" }, { status: 410 });
  } catch (error) {
    return apiErrorResponse(error, "\u521b\u5efa\u5b66\u751f\u5931\u8d25");
  }
}
