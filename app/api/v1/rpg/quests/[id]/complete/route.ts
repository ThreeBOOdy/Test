import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { completeQuest } from "@/lib/server/rpg-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    return NextResponse.json(await completeQuest(user.id, id));
  } catch (error) {
    return apiErrorResponse(error, "完成任务失败");
  }
}
