import { NextResponse } from "next/server";
import { generateStudentWeeklyReport } from "@/lib/server/ai/report";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";

export async function GET() {
  try {
    const user = await requireActiveStudent();
    return NextResponse.json(await generateStudentWeeklyReport(user.id));
  } catch (error) {
    return apiErrorResponse(error, "生成学生周报失败");
  }
}
