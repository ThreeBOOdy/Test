import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { listStudents } from "@/lib/server/student-account-service";

const studentStatuses = new Set(["PENDING", "ACTIVE", "REJECTED"]);

function positiveInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    await requireAdministrator();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    return NextResponse.json(await listStudents({
      page: positiveInteger(url.searchParams.get("page"), 1),
      pageSize: Math.min(100, positiveInteger(url.searchParams.get("pageSize"), 20)),
      search: url.searchParams.get("search") ?? undefined,
      status: status && studentStatuses.has(status) ? status as "PENDING" | "ACTIVE" | "REJECTED" : undefined,
    }));
  } catch (error) { return apiErrorResponse(error, "读取学生账号失败"); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireAdministrator();
    return NextResponse.json({ message: "请使用学生 Excel 导入创建账号" }, { status: 410 });
  } catch (error) {
    return apiErrorResponse(error, "创建学生失败");
  }
}
