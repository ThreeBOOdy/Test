import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { setGradeGamificationEnabled } from "@/lib/server/gamification-settings-service";
import { assertSameOrigin } from "@/lib/server/http";

const schema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await setGradeGamificationEnabled(user.id, id, input.enabled));
  } catch (error) {
    return apiErrorResponse(error, "更新班级游戏化设置失败");
  }
}
