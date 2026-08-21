import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { setStudentActiveLevel } from "@/lib/server/teacher-student-service";

const schema = z
  .object({
    activeLevelId: z.union([z.string().trim().min(1, "请选择字母类").max(191, "字母类标识过长"), z.null()]),
  })
  .strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await setStudentActiveLevel(user.id, id, input.activeLevelId));
  } catch (error) {
    return apiErrorResponse(error, "设置学生字母类失败");
  }
}
