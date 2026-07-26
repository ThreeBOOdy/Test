import { NextResponse } from "next/server";
import { apiErrorResponse, requireRegistrationStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { resubmitRegistration } from "@/lib/server/student-account-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRegistrationStudent();
    return NextResponse.json(await resubmitRegistration(user.id));
  } catch (error) {
    return apiErrorResponse(error, "重新提交申请失败");
  }
}
