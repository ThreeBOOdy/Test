import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/server/password";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_.-]+$/, "用户名只能包含字母、数字、点、横线和下划线"),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const input = schema.parse(await request.json());
    const duplicate = await prisma.user.findUnique({ where: { username: input.username } });
    if (duplicate) throw new Error("用户名已存在");
    const student = await prisma.user.create({ data: { username: input.username, displayName: input.displayName, passwordHash: hashPassword(input.password), role: "STUDENT", enabled: true, mustChangePassword: true } });
    return NextResponse.json({ id: student.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建学生失败" }, { status: 400 });
  }
}