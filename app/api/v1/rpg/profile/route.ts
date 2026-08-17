import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { setGamificationEnabled } from "@/lib/server/rpg-service";

const profileSchema = z.object({
  gamificationEnabled: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const input = profileSchema.parse(await readJsonBody(request));
    return NextResponse.json(await setGamificationEnabled(user.id, input.gamificationEnabled));
  } catch (error) {
    return apiErrorResponse(error, "更新游戏化设置失败");
  }
}
