import { NextResponse } from "next/server";
import { z } from "zod";
import { listExplanationReviews } from "@/lib/server/ai/explanation-review";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.string().trim().max(20).optional(),
  search: z.string().trim().max(200).optional(),
  levelId: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  try {
    await requireTeacher();
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listExplanationReviews({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status ?? "DRAFT",
      search: query.search || undefined,
      levelId: query.levelId || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "读取 AI 解析审核列表失败");
  }
}
