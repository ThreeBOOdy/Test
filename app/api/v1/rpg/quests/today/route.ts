import { NextResponse } from "next/server";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { getTodayQuests } from "@/lib/server/rpg-service";

export async function GET() {
  try {
    const user = await requireActiveStudent();
    return NextResponse.json(await getTodayQuests(user.id));
  } catch (error) {
    return apiErrorResponse(error, "读取今日任务失败");
  }
}
