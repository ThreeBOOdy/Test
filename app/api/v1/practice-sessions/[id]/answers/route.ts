import { NextResponse } from "next/server";
import { z } from "zod";
import { submitDemoAnswer } from "@/lib/server/demo-session-store";

const schema = z.object({ questionId: z.string().min(1), selectedOptionIds: z.array(z.string()).min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json(submitDemoAnswer(id, input.questionId, input.selectedOptionIds));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "提交答案失败" }, { status: 400 });
  }
}
