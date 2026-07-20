import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, getCurrentUser, verifyActionToken } from "@/lib/server/session";
import { publicUrl, setSessionCookie } from "@/lib/server/session-cookie";

const count = z.number().int().min(0).max(500);
const schema = z.object({
  levelRules: z.array(z.object({ levelId: z.string(), singleCount: count, multipleCount: count })),
  knowledgeRules: z.array(z.object({ knowledgePointId: z.string(), levelId: z.string(), singleCount: count, multipleCount: count })),
});
type PracticeRulesInput = z.infer<typeof schema>;

async function savePracticeRules(input: PracticeRulesInput) {
  for (const rule of input.levelRules) {
    if (rule.singleCount === 0 && rule.multipleCount === 0) throw new Error("等级综合练习的单选和多选不能同时为 0");
    const [singleAvailable, multipleAvailable] = await Promise.all([
      prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "SINGLE_CHOICE", knowledgePoint: { enabled: true } } }),
      prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "MULTIPLE_CHOICE", knowledgePoint: { enabled: true } } }),
    ]);
    if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new Error(`等级题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
  }

  for (const rule of input.knowledgeRules.filter((item) => item.singleCount > 0 || item.multipleCount > 0)) {
    const point = await prisma.knowledgePoint.findUnique({ where: { id: rule.knowledgePointId } });
    if (!point || !point.enabled) throw new Error("知识点不存在或已停用");
    const knowledgeScope = { OR: [{ id: point.id }, { path: { startsWith: `${point.path}/` } }] };
    const [singleAvailable, multipleAvailable] = await Promise.all([
      prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "SINGLE_CHOICE", knowledgePoint: { is: knowledgeScope } } }),
      prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "MULTIPLE_CHOICE", knowledgePoint: { is: knowledgeScope } } }),
    ]);
    if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new Error(`${point.code} 题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const rule of input.levelRules) {
      await tx.levelPracticeRule.upsert({
        where: { levelId: rule.levelId },
        update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true },
        create: { ...rule, enabled: true },
      });
    }
    for (const rule of input.knowledgeRules) {
      if (rule.singleCount === 0 && rule.multipleCount === 0) {
        await tx.knowledgePracticeRule.deleteMany({ where: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } });
      } else {
        await tx.knowledgePracticeRule.upsert({
          where: { knowledgePointId_levelId: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } },
          update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true },
          create: { ...rule, enabled: true },
        });
      }
    }
  });
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const input = schema.parse(await request.json());
    await savePracticeRules(input);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存规则失败" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  let teacher: { id: string; username: string } | null = null;

  try {
    const formData = await request.formData();
    const actionToken = String(formData.get("actionToken") ?? "");
    const payload = String(formData.get("payload") ?? "");
    const authorization = await verifyActionToken(actionToken, "SAVE_PRACTICE_RULES");
    if (!authorization) throw new Error("保存授权已过期，请刷新页面后重试");

    teacher = await prisma.user.findFirst({
      where: { id: authorization.userId, role: "TEACHER", enabled: true },
      select: { id: true, username: true },
    });
    if (!teacher) throw new Error("教师账号不存在或已停用");

    const input = schema.parse(JSON.parse(payload));
    await savePracticeRules(input);
    return redirectWithSession(request, teacher, "saved", "1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存规则失败";
    if (teacher) return redirectWithSession(request, teacher, "error", message);
    const url = publicUrl("/login", request);
    url.searchParams.set("next", "/teacher/rules");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  }
}

async function redirectWithSession(request: Request, teacher: { id: string; username: string }, key: "saved" | "error", value: string) {
  const url = publicUrl("/teacher/rules", request);
  url.searchParams.set(key, value.slice(0, 240));
  const response = NextResponse.redirect(url, 303);
  const sessionToken = await createSessionToken({ userId: teacher.id, username: teacher.username, role: "TEACHER" });
  return setSessionCookie(response, sessionToken);
}