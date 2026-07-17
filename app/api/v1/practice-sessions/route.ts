import { NextResponse } from "next/server";
import { z } from "zod";
import { createDemoSession } from "@/lib/server/demo-session-store";

const schema = z.object({ mode: z.enum(["level", "knowledge"]), levelCode: z.string().min(1), knowledgePointId: z.string().optional() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(createDemoSession(input), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建练习失败" }, { status: 400 });
  }
}
