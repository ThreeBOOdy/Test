import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({ name: z.string().trim().min(1).max(200), sortOrder: z.number().int().min(0).max(100000), enabled: z.boolean() });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const point = await prisma.knowledgePoint.findUnique({ where: { id } });
    if (!point) throw new Error("知识点不存在");
    await prisma.$transaction([
      prisma.knowledgePoint.update({ where: { id }, data: { name: input.name, sortOrder: input.sortOrder } }),
      prisma.knowledgePoint.updateMany({
        where: { OR: [{ id }, { path: { startsWith: `${point.path}/` } }] },
        data: { enabled: input.enabled },
      }),
    ]);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新知识点失败" }, { status: 400 });
  }
}