import { NextResponse } from "next/server";
import { z } from "zod";
import { createPracticeSession } from "@/lib/server/practice-service";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({ mode: z.enum(["level", "knowledge"]), levelCode: z.string().min(1), knowledgePointId: z.string().optional() });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") return NextResponse.json({ message: "请先以学生身份登录" }, { status: 401 });
    const input = schema.parse(await request.json());
    return NextResponse.json(await createPracticeSession(user.id, input), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建练习失败" }, { status: 400 });
  }
}
