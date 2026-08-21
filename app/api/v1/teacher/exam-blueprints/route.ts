import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { createExamBlueprint, listExamBlueprints } from "@/lib/server/exam-blueprint-service";

const itemSchema = z
  .object({
    knowledgePointId: z.string().min(1, "请选择知识点"),
    singleCount: z.number().int().min(0, "单选题数量必须是非负整数").max(1000, "单选题数量不能超过 1000"),
    multipleCount: z.number().int().min(0, "多选题数量必须是非负整数").max(1000, "多选题数量不能超过 1000"),
  })
  .refine((item) => item.singleCount + item.multipleCount > 0, { message: "蓝图条目题量不能为 0" });

export const examBlueprintItemSchema = itemSchema;

const createBlueprintSchema = z.object({
  levelId: z.string().min(1, "请选择字母类"),
  name: z.string().trim().min(1, "请输入蓝图名称").max(100, "蓝图名称不能超过 100 个字符"),
  durationMinutes: z.number().int().min(1, "考试时间必须大于 0 分钟").max(1440, "考试时间不能超过 1440 分钟").nullable().optional(),
  passingCount: z.number().int().min(1, "合格题数必须大于 0").max(1000, "合格题数不能超过 1000"),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  items: z.array(itemSchema).min(1, "蓝图至少需要一个条目"),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function mapBlueprint(blueprint: {
  id: string;
  levelId: string;
  name: string;
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    blueprintId: string;
    knowledgePointId: string;
    singleCount: number;
    multipleCount: number;
    knowledgePoint?: { id: string; code: string; name: string; path: string } | null;
  }>;
}) {
  const totalCount = blueprint.items.reduce((sum, item) => sum + item.singleCount + item.multipleCount, 0);
  return {
    id: blueprint.id,
    levelId: blueprint.levelId,
    name: blueprint.name,
    durationMinutes: blueprint.durationMinutes,
    passingCount: blueprint.passingCount,
    enabled: blueprint.enabled,
    isDefault: blueprint.isDefault,
    totalCount,
    createdAt: blueprint.createdAt.toISOString(),
    updatedAt: blueprint.updatedAt.toISOString(),
    items: blueprint.items.map((item) => ({
      id: item.id,
      blueprintId: item.blueprintId,
      knowledgePointId: item.knowledgePointId,
      knowledgePoint: item.knowledgePoint ? { id: item.knowledgePoint.id, code: item.knowledgePoint.code, name: item.knowledgePoint.name, path: item.knowledgePoint.path } : null,
      singleCount: item.singleCount,
      multipleCount: item.multipleCount,
    })),
  };
}

export { mapBlueprint };

export async function GET(request: Request) {
  try {
    await requireTeacher();
    const url = new URL(request.url);
    const levelId = url.searchParams.get("levelId") || undefined;
    const blueprints = await listExamBlueprints(levelId);
    return NextResponse.json({ blueprints: blueprints.map(mapBlueprint) });
  } catch (error) {
    return apiErrorResponse(error, "读取蓝图失败");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireTeacher();
    const input = createBlueprintSchema.parse(await readJsonBody(request));
    const blueprint = await createExamBlueprint(user.id, {
      levelId: input.levelId,
      name: input.name,
      durationMinutes: input.durationMinutes ?? null,
      passingCount: input.passingCount,
      enabled: input.enabled,
      isDefault: input.isDefault,
      items: input.items,
    });
    return NextResponse.json({ id: blueprint.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("蓝图名称已存在", 409), "创建蓝图失败");
    return apiErrorResponse(error, "创建蓝图失败");
  }
}
