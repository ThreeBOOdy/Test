import { NextResponse } from "next/server";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { listGradeGamificationSettings } from "@/lib/server/gamification-settings-service";

export async function GET() {
  try {
    await requireTeacher();
    return NextResponse.json({ grades: await listGradeGamificationSettings() });
  } catch (error) {
    return apiErrorResponse(error, "读取班级游戏化设置失败");
  }
}
