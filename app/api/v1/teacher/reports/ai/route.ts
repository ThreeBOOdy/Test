import { NextResponse } from "next/server";
import { generateTeacherClassReport } from "@/lib/server/ai/report";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

export async function GET() {
  try {
    const user = await requireTeacher();
    return NextResponse.json(await generateTeacherClassReport(user.id));
  } catch (error) {
    return apiErrorResponse(error, "生成班级 AI 报告失败");
  }
}
