import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { rejectRegistration } from "@/lib/server/student-account-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const admin = await requireAdministrator(); const { id } = await context.params; return NextResponse.json(await rejectRegistration(admin.id, id, await readJsonBody(request))); }
  catch (error) { return apiErrorResponse(error, "拒绝申请失败"); }
}
