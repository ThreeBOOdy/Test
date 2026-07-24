import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { submitMockExam } from "@/lib/server/practice-service";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireRole } from "@/lib/server/api";

const schema = z.object({ answers: z.array(z.object({ questionId: z.string().min(1), selectedOptionIds: z.array(z.string()) })) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("STUDENT");
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await submitMockExam(user.id, id, input.answers));
  } catch (error) {
    return apiErrorResponse(error, "模拟考试交卷失败");
  }
}
