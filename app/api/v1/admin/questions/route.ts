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
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).default("ACTIVE"),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const input = schema.parse(await request.json());
    const normalized = normalizeQuestionEditorInput(input);
    const [level, point] = await Promise.all([
      prisma.level.findFirst({ where: { id: input.levelId, enabled: true } }),
      prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, enabled: true }, include: { _count: { select: { children: true } } } }),
    ]);
    if (!level) throw new Error("等级不存在或已停用");
    if (!point) throw new Error("知识点不存在或已停用");
    if (point._count.children > 0) throw new Error("题目必须归属末级知识点");
    if (input.externalQuestionCode) {
      const duplicate = await prisma.question.findFirst({ where: { levelId: input.levelId, externalQuestionCode: input.externalQuestionCode } });
      if (duplicate) throw new Error("该等级下已存在相同题目编号");
    }
    const question = await prisma.question.create({
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
    return NextResponse.json({ id: question.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建题目失败" }, { status: 400 });
  }
}