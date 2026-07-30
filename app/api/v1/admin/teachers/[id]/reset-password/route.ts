import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { resetTeacherPassword } from "@/lib/server/teacher-account-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdministrator();
    const { id } = await context.params;
    return NextResponse.json(await resetTeacherPassword(administrator.id, id));
  } catch (error) { return apiErrorResponse(error, "重置教师密码失败"); }
}
