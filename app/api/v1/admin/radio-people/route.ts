import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { createRadioPerson, listRadioPeopleForAdministration } from "@/lib/server/student-account-service";

export async function GET() {
  try {
    await requireAdministrator();
    return NextResponse.json({ items: await listRadioPeopleForAdministration() });
  } catch (error) {
    return apiErrorResponse(error, "读取人物目录失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdministrator();
    return NextResponse.json(await createRadioPerson(administrator.id, await readJsonBody(request)), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "创建人物身份失败");
  }
}