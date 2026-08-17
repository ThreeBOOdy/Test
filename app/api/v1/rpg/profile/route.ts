import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { updatePlayerProfile } from "@/lib/server/rpg-service";

const profileSchema = z.object({
  gamificationEnabled: z.boolean().optional(),
  mapEnabled: z.boolean().optional(),
}).refine((input) => input.gamificationEnabled !== undefined || input.mapEnabled !== undefined, {
  message: "至少提供一个设置项",
});

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const input = profileSchema.parse(await readJsonBody(request));
    return NextResponse.json(await updatePlayerProfile(user.id, input));
  } catch (error) {
    return apiErrorResponse(error, "更新玩家设置失败");
  }
}
