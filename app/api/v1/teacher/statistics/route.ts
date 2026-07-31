import { NextResponse } from "next/server";
import { getTeacherLearningStatistics } from "@/lib/server/learning-statistics-service";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

export async function GET(request: Request) {
  try {
    await requireTeacher();
    const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);
    return NextResponse.json(await getTeacherLearningStatistics(since));
  } catch (error) {
    return apiErrorResponse(error, "读取教学统计失败");
  }
}
