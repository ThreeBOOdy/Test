import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { updateRadioPerson } from "@/lib/server/student-account-service";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdministrator();
    const { id } = await context.params;
    return NextResponse.json(await updateRadioPerson(administrator.id, id, await readJsonBody(request)));
  } catch (error) {
    return apiErrorResponse(error, "更新人物目录失败");
  }
}