import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeKnowledgeCode } from "@/lib/domain/knowledge-code";
import { ensureKnowledgePoint } from "@/lib/server/knowledge-service";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({ code: z.string(), name: z.string().trim().min(1).max(200), sortOrder: z.number().int().min(0).max(100000).default(0) });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const input = schema.parse(await request.json());
    const code = normalizeKnowledgeCode(input.code);
    const existing = await prisma.knowledgePoint.findUnique({ where: { code } });
    if (existing) throw new Error("分类号已存在");
    const point = await prisma.$transaction((tx) => ensureKnowledgePoint(tx, code, input.name, input.sortOrder));
    return NextResponse.json({ id: point.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建知识点失败" }, { status: 400 });
  }
}