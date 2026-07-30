import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { approveRegistration } from "@/lib/server/student-account-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const reviewer = await requireAdministrator(); const { id } = await context.params; return NextResponse.json(await approveRegistration(reviewer.id, id, await readJsonBody(request))); }
  catch (error) { return apiErrorResponse(error, "审核通过失败"); }
}
