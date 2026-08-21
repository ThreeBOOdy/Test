import { NextResponse } from "next/server";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { listTeacherStudents } from "@/lib/server/teacher-student-service";

const studentStatuses = new Set(["PENDING", "ACTIVE", "REJECTED"]);

function positiveInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    await requireTeacher();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    return NextResponse.json(await listTeacherStudents({
      page: positiveInteger(url.searchParams.get("page"), 1),
      pageSize: Math.min(100, positiveInteger(url.searchParams.get("pageSize"), 20)),
      search: url.searchParams.get("search") ?? undefined,
      status: status && studentStatuses.has(status) ? status as "PENDING" | "ACTIVE" | "REJECTED" : undefined,
    }));
  } catch (error) {
    return apiErrorResponse(error, "读取学生列表失败");
  }
}
