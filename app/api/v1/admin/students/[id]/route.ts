import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { getStudentDetail, updateStudentAccount } from "@/lib/server/student-account-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAdministrator(); const { id } = await context.params; return NextResponse.json(await getStudentDetail(id)); }
  catch (error) { return apiErrorResponse(error, "读取学生详情失败"); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAdministrator();
    const { id } = await context.params;
    return NextResponse.json(await updateStudentAccount(user.id, id, await readJsonBody(request)));
  } catch (error) {
    return apiErrorResponse(error, "\u66f4\u65b0\u5b66\u751f\u5931\u8d25");
  }
}
