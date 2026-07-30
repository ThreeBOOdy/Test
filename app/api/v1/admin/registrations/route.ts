import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { listRegistrationReviews } from "@/lib/server/student-account-service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "ACTIVE", "REJECTED"]).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdministrator();
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    return NextResponse.json(await listRegistrationReviews({ ...query, status: query.status ?? "PENDING" }));
  } catch (error) {
    return apiErrorResponse(error, "读取待审核注册失败");
  }
}
