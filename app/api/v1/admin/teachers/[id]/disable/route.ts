import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { deactivateTeacherAccount } from "@/lib/server/teacher-account-service";
import { assertSameOrigin } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdministrator();
    const { id } = await context.params;
    return NextResponse.json(await deactivateTeacherAccount(administrator.id, id));
  } catch (error) { return apiErrorResponse(error, "停用教师账号失败"); }
}
