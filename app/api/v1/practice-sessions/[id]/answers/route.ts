import { NextResponse } from "next/server";
import { z } from "zod";
import { submitPracticeAnswer } from "@/lib/server/practice-service";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({ questionId: z.string().min(1), selectedOptionIds: z.array(z.string()).min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") return NextResponse.json({ message: "请先以学生身份登录" }, { status: 401 });
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json(await submitPracticeAnswer(user.id, id, input.questionId, input.selectedOptionIds));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "提交答案失败" }, { status: 400 });
  }
}
