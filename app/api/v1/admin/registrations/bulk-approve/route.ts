import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { approveRegistration } from "@/lib/server/student-account-service";
import { getBusinessDate } from "@/lib/server/time";

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });
export async function POST(request: Request) {
  try { assertSameOrigin(request); const reviewer = await requireAdministrator(); const { ids } = schema.parse(await readJsonBody(request)); const today = getBusinessDate(); for (const id of ids) await approveRegistration(reviewer.id, id, {}, today); return NextResponse.json({ approved: ids.length }); }
  catch (error) { return apiErrorResponse(error, "批量审核失败"); }
}
