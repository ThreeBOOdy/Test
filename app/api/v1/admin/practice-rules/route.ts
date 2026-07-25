import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiError, apiErrorResponse, requireRole } from "@/lib/server/api";
import { validateExamRule } from "@/lib/domain/exam-rules";

const count = z.number().int().min(0).max(1000);
const schema = z.object({
  levelRules: z.array(z.object({ levelId: z.string(), singleCount: count, multipleCount: count })),
  knowledgeRules: z.array(z.object({ knowledgePointId: z.string(), levelId: z.string(), singleCount: count, multipleCount: count })),
  examRules: z.array(z.object({ levelId: z.string(), singleCount: count, multipleCount: count, durationMinutes: z.number().int().min(1).max(1440), passingCount: z.number().int().min(1).max(1000) })),
});

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("TEACHER");
    const input = schema.parse(await readJsonBody(request));
    for (const rule of input.levelRules) {
      if (rule.singleCount === 0 && rule.multipleCount === 0) throw new ApiError("等级综合练习的单选和多选不能同时为 0");
      const [singleAvailable, multipleAvailable] = await Promise.all([
        prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "SINGLE_CHOICE", knowledgePoint: { enabled: true } } }),
        prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "MULTIPLE_CHOICE", knowledgePoint: { enabled: true } } }),
      ]);
      if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new ApiError(`等级题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
    }
    for (const rule of input.knowledgeRules.filter((item) => item.singleCount > 0 || item.multipleCount > 0)) {
      const point = await prisma.knowledgePoint.findUnique({ where: { id: rule.knowledgePointId }, include: { _count: { select: { children: true } } } });
      if (!point || !point.enabled) throw new ApiError("知识点不存在或已停用", 404);
      if (point.depth !== 2 || point._count.children > 0) throw new ApiError("专项练习规则只能配置二级末级知识点");
      const [singleAvailable, multipleAvailable] = await Promise.all([
        prisma.question.count({ where: { levelId: rule.levelId, knowledgePointId: point.id, status: "ACTIVE", type: "SINGLE_CHOICE" } }),
        prisma.question.count({ where: { levelId: rule.levelId, knowledgePointId: point.id, status: "ACTIVE", type: "MULTIPLE_CHOICE" } }),
      ]);
      if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new ApiError(`${point.code} 题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
    }
    for (const rule of input.examRules) {
      try { validateExamRule(rule); } catch (error) { throw new ApiError(error instanceof Error ? error.message : "模拟考试规则无效"); }
      const [singleAvailable, multipleAvailable] = await Promise.all([
        prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "SINGLE_CHOICE", knowledgePoint: { enabled: true } } }),
        prisma.question.count({ where: { levelId: rule.levelId, status: "ACTIVE", type: "MULTIPLE_CHOICE", knowledgePoint: { enabled: true } } }),
      ]);
      if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new ApiError(`模拟考试题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
    }
    await prisma.$transaction(async (tx) => {
      for (const rule of input.levelRules) await tx.levelPracticeRule.upsert({ where: { levelId: rule.levelId }, update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true }, create: { ...rule, enabled: true } });
      for (const rule of input.knowledgeRules) {
        if (rule.singleCount === 0 && rule.multipleCount === 0) await tx.knowledgePracticeRule.deleteMany({ where: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } });
        else await tx.knowledgePracticeRule.upsert({ where: { knowledgePointId_levelId: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } }, update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true }, create: { ...rule, enabled: true } });
      }
      for (const rule of input.examRules) await tx.examRule.upsert({ where: { levelId: rule.levelId }, update: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, durationMinutes: rule.durationMinutes, passingCount: rule.passingCount, enabled: true }, create: { ...rule, enabled: true } });
    });
    await writeAuditLog({ actorUserId: user.id, action: "PRACTICE_RULES_UPDATE", targetType: "PracticeRule", metadata: { levelRules: input.levelRules.length, knowledgeRules: input.knowledgeRules.length, examRules: input.examRules.length } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "保存规则失败");
  }
}
