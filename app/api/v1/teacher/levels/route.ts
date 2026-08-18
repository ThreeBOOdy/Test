import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { isLevelCode, normalizeLevelCode } from "@/lib/domain/level-code";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";

const createLevelSchema = z.object({
  code: z.string().trim().min(1, "请输入字母类代码").max(50, "字母类代码不能超过 50 个字符").refine(isLevelCode, { message: "字母类代码只能包含英文字母（如 A、B、C、K、AA）" }),
  name: z.string().trim().min(1, "请输入字母类名称").max(100, "字母类名称不能超过 100 个字符"),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  enabled: z.boolean().default(true),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET() {
  try {
    await requireTeacher();
    const levels = await prisma.level.findMany({
      include: { _count: { select: { questions: true } } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json({
      levels: levels.map((level) => ({
        id: level.id,
        code: level.code,
        name: level.name,
        sortOrder: level.sortOrder,
        enabled: level.enabled,
        updatedAt: level.updatedAt.toISOString(),
        questionCount: level._count.questions,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "读取字母类失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = createLevelSchema.parse(await readJsonBody(request));
    const code = normalizeLevelCode(input.code);
    const level = await prisma.level.create({
      data: { code, name: input.name, sortOrder: input.sortOrder, enabled: input.enabled },
    });
    await writeAuditLog({ actorUserId: user.id, action: "LEVEL_CREATE", targetType: "Level", targetId: level.id, metadata: { code, enabled: input.enabled } });
    return NextResponse.json({ id: level.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("字母类代码已存在", 409), "创建字母类失败");
    return apiErrorResponse(error, "创建字母类失败");
  }
}
