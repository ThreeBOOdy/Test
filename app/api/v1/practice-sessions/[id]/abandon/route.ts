import { NextResponse } from "next/server";
import { abandonMockExam } from "@/lib/server/practice-service";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    return NextResponse.json(await abandonMockExam(user.id, id));
  } catch (error) {
    return apiErrorResponse(error, "放弃模拟考试失败");
  }
}