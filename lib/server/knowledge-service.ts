import "server-only";
import { ApiError } from "@/lib/domain/api-error";
import { prisma } from "@/lib/db";
import { getKnowledgeCodePrefixes, normalizeKnowledgeCode } from "@/lib/domain/knowledge-code";

export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const DEFAULT_KNOWLEDGE_POINT_TYPE_CODE = "DEFAULT";
export const DEFAULT_KNOWLEDGE_POINT_TYPE_NAME = "默认";

export async function getOrCreateDefaultKnowledgePointType(tx: PrismaTransaction = prisma) {
  const existing = await tx.knowledgePointType.findUnique({ where: { code: DEFAULT_KNOWLEDGE_POINT_TYPE_CODE } });
  if (existing) return existing;
  return tx.knowledgePointType.create({
    data: {
      code: DEFAULT_KNOWLEDGE_POINT_TYPE_CODE,
      name: DEFAULT_KNOWLEDGE_POINT_TYPE_NAME,
      sortOrder: 0,
      enabled: true,
    },
  });
}

export async function ensureKnowledgePoint(
  tx: PrismaTransaction,
  rawCode: string,
  leafName?: string,
  leafSortOrder = 0,
  typeId?: string,
) {
  const code = normalizeKnowledgeCode(rawCode);
  const codePrefixes = getKnowledgeCodePrefixes(code);
  const resolvedTypeId = typeId ?? (await getOrCreateDefaultKnowledgePointType(tx)).id;
  let parentId: string | null = null;
  let current = null as Awaited<ReturnType<typeof tx.knowledgePoint.findFirst>>;

  for (let index = 0; index < codePrefixes.length; index += 1) {
    const currentCode = codePrefixes[index];
    const isLeaf = index === codePrefixes.length - 1;
    const existing = await tx.knowledgePoint.findFirst({ where: { typeId: resolvedTypeId, code: currentCode }, include: { _count: { select: { questions: true } } } });
    if (existing && !isLeaf && existing._count.questions > 0) {
      throw new ApiError(`知识点 ${existing.code} 已有直属题目，不能再创建下级节点`, 409);
    }
    if (existing && !existing.enabled) {
      throw new ApiError(`知识点 ${existing.code} 已停用`, 409);
    }
    current = await tx.knowledgePoint.upsert({
      where: { typeId_code: { typeId: resolvedTypeId, code: currentCode } },
      update: isLeaf ? { ...(leafName?.trim() ? { name: leafName.trim() } : {}), sortOrder: leafSortOrder } : {},
      create: {
        typeId: resolvedTypeId,
        code: currentCode,
        name: isLeaf && leafName?.trim() ? leafName.trim() : currentCode,
        parentId,
        path: `/${codePrefixes.slice(0, index + 1).join("/")}`,
        depth: index,
        sortOrder: isLeaf ? leafSortOrder : 0,
        enabled: true,
      },
    });
    parentId = current.id;
  }

  if (!current) throw new ApiError("知识点创建失败", 500);
  return current;
}
