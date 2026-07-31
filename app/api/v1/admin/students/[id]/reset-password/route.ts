import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { resetStudentPassword } from "@/lib/server/student-account-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdministrator();
    const { id } = await context.params;
    return NextResponse.json(await resetStudentPassword(admin.id, id));
  } catch (error) {
    return apiErrorResponse(error, "重置密码失败");
  }
}
