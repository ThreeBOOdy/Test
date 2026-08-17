import { NextResponse } from "next/server";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { getPlayerStatus } from "@/lib/server/rpg-service";

export async function GET() {
  try {
    const user = await requireActiveStudent();
    return NextResponse.json(await getPlayerStatus(user.id));
  } catch (error) {
    return apiErrorResponse(error, "获取玩家状态失败");
  }
}
