import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { createPracticeSession } from "@/lib/server/practice-service";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse, requireRole } from "@/lib/server/api";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("level"), levelCode: z.string().min(1) }),
  z.object({ mode: z.literal("knowledge"), levelCode: z.string().min(1), knowledgePointId: z.string().min(1) }),
  z.object({ mode: z.literal("wrong") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("STUDENT");
    const input = schema.parse(await readJsonBody(request));
    return NextResponse.json(await createPracticeSession(user.id, input), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "创建练习失败");
  }
}
