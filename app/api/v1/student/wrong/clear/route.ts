import { NextResponse } from "next/server";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { clearOwnWrongQuestions } from "@/lib/server/wrong-question-clear-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    return NextResponse.json(await clearOwnWrongQuestions(user.id));
  } catch (error) {
    return apiErrorResponse(error, "清除错题失败");
  }
}
