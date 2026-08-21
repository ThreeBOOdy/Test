import { NextResponse } from "next/server";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { clearStudentWrongQuestions } from "@/lib/server/wrong-question-clear-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const { id } = await context.params;
    return NextResponse.json(await clearStudentWrongQuestions(user.id, id));
  } catch (error) {
    return apiErrorResponse(error, "清除学生错题失败");
  }
}
