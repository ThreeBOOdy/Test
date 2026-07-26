import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { listStudents } from "@/lib/server/student-account-service";

export async function GET(request: Request) {
  try {
    await requireAdministrator();
    const url = new URL(request.url);
    const items = await listStudents({ status: "PENDING", search: url.searchParams.get("search") ?? undefined });
    return NextResponse.json({ items, total: items.length });
  } catch (error) { return apiErrorResponse(error, "读取注册申请失败"); }
}
