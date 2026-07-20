import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeQuestionEditorInput } from "@/lib/domain/question-editor";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({
  levelId: z.string().min(1),
  knowledgePointId: z.string().min(1),
  sourceBankCode: z.string().trim().max(100).optional(),
  externalQuestionCode: z.string().trim().max(100).optional(),
  stem: z.string().trim().min(1).max(5000),
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2).max(8),
  correctOptionIds: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "TEACHER") return NextResponse.json({ message: "需要教师权限" }, { status: 403 });
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const normalized = normalizeQuestionEditorInput(input);
    const [question, level, point] = await Promise.all([
      prisma.question.findUnique({ where: { id } }),
      prisma.level.findUnique({ where: { id: input.levelId } }),
      prisma.knowledgePoint.findUnique({ where: { id: input.knowledgePointId }, include: { _count: { select: { children: true } } } }),
    ]);
    if (!question) throw new Error("题目不存在");
    if (!level || (!level.enabled && input.levelId !== question.levelId)) throw new Error("等级不存在或已停用");
    if (!point || (!point.enabled && input.knowledgePointId !== question.knowledgePointId)) throw new Error("知识点不存在或已停用");
    if (point._count.children > 0) throw new Error("题目必须归属末级知识点");
    if (input.externalQuestionCode) {
      const duplicate = await prisma.question.findFirst({ where: { id: { not: id }, levelId: input.levelId, externalQuestionCode: input.externalQuestionCode } });
      if (duplicate) throw new Error("该等级下已存在相同题目编号");
    }
    await prisma.question.update({
      where: { id },
      data: {
        levelId: input.levelId,
        knowledgePointId: input.knowledgePointId,
        sourceBankCode: input.sourceBankCode || null,
        externalQuestionCode: input.externalQuestionCode || null,
        stem: input.stem,
        type: normalized.type,
        optionCount: normalized.optionCount,
        correctOptionCount: normalized.correctOptionCount,
        selectionSpec: normalized.selectionSpec,
        options: normalized.options as Prisma.InputJsonValue,
        correctOptionIds: normalized.correctOptionIds,
        status: input.status,
      },
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新题目失败" }, { status: 400 });
  }
}