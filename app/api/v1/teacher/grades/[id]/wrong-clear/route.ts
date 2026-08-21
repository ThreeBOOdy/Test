import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { setGradeStudentSelfWrongClearEnabled } from "@/lib/server/gamification-settings-service";
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
    return NextResponse.json(await setGradeStudentSelfWrongClearEnabled(user.id, id, input.enabled));
  } catch (error) {
    return apiErrorResponse(error, "更新学生自助清除错题设置失败");
  }
}
