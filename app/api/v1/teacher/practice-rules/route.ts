import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLogInTransaction } from "@/lib/server/audit";
import { STALE_VERSION_MESSAGE } from "@/lib/server/question-revisions";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { validateExamRule } from "@/lib/domain/exam-rules";

const count = z.number().int().min(0).max(1000);
const version = z.number().int().positive().optional();
const schema = z.object({
  levelRules: z.array(z.object({ levelId: z.string(), singleCount: count, multipleCount: count, version })),
  knowledgeRules: z.array(z.object({ knowledgePointId: z.string(), levelId: z.string(), singleCount: count, multipleCount: count, version })),
  examRules: z.array(z.object({ levelId: z.string(), singleCount: count, multipleCount: count, durationMinutes: z.number().int().min(1).max(1440), passingCount: z.number().int().min(1).max(1000), version })),
});

async function assertInventory(input: z.infer<typeof schema>) {
  for (const rule of input.levelRules) {
    if (rule.singleCount === 0 && rule.multipleCount === 0) throw new ApiError("等级综合练习的单选和多选不能同时为 0");
    const [singleAvailable, multipleAvailable] = await Promise.all([
      prisma.question.count({ where: { levels: { some: { levelId: rule.levelId } }, status: "ACTIVE", type: "SINGLE_CHOICE", knowledgePoint: { enabled: true } } }),
      prisma.question.count({ where: { levels: { some: { levelId: rule.levelId } }, status: "ACTIVE", type: "MULTIPLE_CHOICE", knowledgePoint: { enabled: true } } }),
    ]);
    if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new ApiError(`等级题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
  }
  for (const rule of input.knowledgeRules.filter((item) => item.singleCount > 0 || item.multipleCount > 0)) {
    const point = await prisma.knowledgePoint.findFirst({ where: { id: rule.knowledgePointId }, include: { _count: { select: { children: true } } } });
    if (!point || !point.enabled) throw new ApiError("知识点不存在或已停用", 404);
    if (point._count.children > 0) throw new ApiError("专项练习规则只能配置末级知识点");
    const [singleAvailable, multipleAvailable] = await Promise.all([
      prisma.question.count({ where: { levels: { some: { levelId: rule.levelId } }, knowledgePointId: point.id, status: "ACTIVE", type: "SINGLE_CHOICE" } }),
      prisma.question.count({ where: { levels: { some: { levelId: rule.levelId } }, knowledgePointId: point.id, status: "ACTIVE", type: "MULTIPLE_CHOICE" } }),
    ]);
    if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new ApiError(`${point.code} 题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
  }
  for (const rule of input.examRules) {
    try { validateExamRule(rule); } catch (error) { throw new ApiError(error instanceof Error ? error.message : "模拟考试规则无效"); }
    const [singleAvailable, multipleAvailable] = await Promise.all([
      prisma.question.count({ where: { levels: { some: { levelId: rule.levelId } }, status: "ACTIVE", type: "SINGLE_CHOICE", knowledgePoint: { enabled: true } } }),
      prisma.question.count({ where: { levels: { some: { levelId: rule.levelId } }, status: "ACTIVE", type: "MULTIPLE_CHOICE", knowledgePoint: { enabled: true } } }),
    ]);
    if (rule.singleCount > singleAvailable || rule.multipleCount > multipleAvailable) throw new ApiError(`模拟考试题量超过库存：单选 ${singleAvailable}，多选 ${multipleAvailable}`);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = schema.parse(await readJsonBody(request));
    await assertInventory(input);
    await prisma.$transaction(async (tx) => {
      for (const rule of input.levelRules) {
        if (rule.version) {
          const changed = await tx.levelPracticeRule.updateMany({ where: { levelId: rule.levelId, version: rule.version }, data: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true, version: { increment: 1 } } });
          if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
        } else {
          const existing = await tx.levelPracticeRule.findUnique({ where: { levelId: rule.levelId } });
          if (existing) throw new ApiError(STALE_VERSION_MESSAGE, 409);
          await tx.levelPracticeRule.create({ data: { levelId: rule.levelId, singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true } });
        }
      }
      for (const rule of input.knowledgeRules) {
        if (rule.singleCount === 0 && rule.multipleCount === 0) {
          if (!rule.version) {
            const existing = await tx.knowledgePracticeRule.findUnique({ where: { knowledgePointId_levelId: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } } });
            if (existing) throw new ApiError(STALE_VERSION_MESSAGE, 409);
            continue;
          }
          const deleted = await tx.knowledgePracticeRule.deleteMany({ where: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId, version: rule.version } });
          if (deleted.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
        } else if (rule.version) {
          const changed = await tx.knowledgePracticeRule.updateMany({ where: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId, version: rule.version }, data: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true, version: { increment: 1 } } });
          if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
        } else {
          const existing = await tx.knowledgePracticeRule.findUnique({ where: { knowledgePointId_levelId: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId } } });
          if (existing) throw new ApiError(STALE_VERSION_MESSAGE, 409);
          await tx.knowledgePracticeRule.create({ data: { knowledgePointId: rule.knowledgePointId, levelId: rule.levelId, singleCount: rule.singleCount, multipleCount: rule.multipleCount, enabled: true } });
        }
      }
      for (const rule of input.examRules) {
        if (rule.version) {
          const changed = await tx.examRule.updateMany({ where: { levelId: rule.levelId, version: rule.version }, data: { singleCount: rule.singleCount, multipleCount: rule.multipleCount, durationMinutes: rule.durationMinutes, passingCount: rule.passingCount, enabled: true, version: { increment: 1 } } });
          if (changed.count !== 1) throw new ApiError(STALE_VERSION_MESSAGE, 409);
        } else {
          const existing = await tx.examRule.findUnique({ where: { levelId: rule.levelId } });
          if (existing) throw new ApiError(STALE_VERSION_MESSAGE, 409);
          await tx.examRule.create({ data: { levelId: rule.levelId, singleCount: rule.singleCount, multipleCount: rule.multipleCount, durationMinutes: rule.durationMinutes, passingCount: rule.passingCount, enabled: true } });
        }
      }
      await writeAuditLogInTransaction(tx, { actorUserId: user.id, action: "PRACTICE_RULES_UPDATE", targetType: "PracticeRuleSet", targetId: "practice-rules", metadata: { levelRules: input.levelRules.length, knowledgeRules: input.knowledgeRules.length, examRules: input.examRules.length } });
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "保存练习规则失败");
  }
}
