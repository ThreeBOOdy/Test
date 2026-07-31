import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { getPracticeSession, saveExamDraft } from "@/lib/server/practice-service";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";

const schema = z.object({ answers: z.record(z.string(), z.array(z.string())), currentIndex: z.number().int().min(0), version: z.number().int().min(0) });

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(_);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    const session = await getPracticeSession(user.id, id);
    if (!session || session.mode !== "MOCK_EXAM") return NextResponse.json({ message: "模拟考试不存在" }, { status: 404 });
    return NextResponse.json(session.draft ?? { answers: {}, currentIndex: 0, version: 0, updatedAt: new Date(0).toISOString() });
  } catch (error) {
    return apiErrorResponse(error, "读取考试草稿失败");
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireActiveStudent();
    const { id } = await context.params;
    return NextResponse.json(await saveExamDraft(user.id, id, schema.parse(await readJsonBody(request))));
  } catch (error) {
    return apiErrorResponse(error, "保存考试草稿失败");
  }
}
