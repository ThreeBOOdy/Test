import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";

const count = z.number().int().min(0).max(1000);
const schema = z.object({
  levelRules: z.array(z.object({ levelId: z.string(), singleCount: count, multipleCount: count })),
  knowledgeRules: z.array(z.object({ knowledgePointId: z.string(), levelId: z.string(), singleCount: count, multipleCount: count })),
});

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "TEACHER") return NextResponse.json({ message: "需要教师权限" }, { status: 403 });
    const input = schema.parse(await request.json());
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
      for (const rule of input.levelRules) await tx.levelPracticeRule.upsert({ where: { levelId: rule.levelId }, update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true }, create: { ...rule, enabled: true } });
      for (const rule of input.knowledgeRules) {
        if (rule.singleCount === 0 && rule.multipleCount === 0) await tx.knowledgePracticeRule.deleteMany({ where: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } });
        else await tx.knowledgePracticeRule.upsert({ where: { knowledgePointId_levelId: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } }, update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true }, create: { ...rule, enabled: true } });
      }
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存规则失败" }, { status: 400 });
  }
}
