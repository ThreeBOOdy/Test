import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireRegistrationStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { getRegistrationEditProfile, getRegistrationStatus, updateRegistrationProfile } from "@/lib/server/student-account-service";

export async function GET(request: Request) {
  try {
    const user = await requireRegistrationStudent();
    const edit = new URL(request.url).searchParams.get("edit") === "true";
    return NextResponse.json(edit ? await getRegistrationEditProfile(user.id) : await getRegistrationStatus(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "读取申请资料失败");
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRegistrationStudent();
    return NextResponse.json(await updateRegistrationProfile(user.id, await readJsonBody(request)));
  } catch (error) {
    return apiErrorResponse(error, "更新申请资料失败");
  }
}
