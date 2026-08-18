import "server-only";
import { ApiError } from "@/lib/domain/api-error";
import { deriveKnowledgePointTypeCode, normalizeKnowledgePointTypeCode } from "@/lib/domain/knowledge-point-type-code";
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

export type KnowledgePointTypeImportInput = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  sheetName?: string | null;
};

async function getUniqueKnowledgePointTypeCode(tx: PrismaTransaction, baseCode: string) {
  let candidate = baseCode;
  let suffix = 2;
  while (await tx.knowledgePointType.findUnique({ where: { code: candidate } })) {
    const suffixText = String(suffix);
    const maxBase = Math.max(1, 50 - suffixText.length - 1);
    candidate = `${baseCode.slice(0, maxBase)}_${suffixText}`;
    suffix += 1;
  }
  return candidate;
}

export async function getOrCreateKnowledgePointType(tx: PrismaTransaction, input: KnowledgePointTypeImportInput = {}) {
  const id = input.id?.trim();
  if (id) {
    const type = await tx.knowledgePointType.findUnique({ where: { id } });
    if (!type) throw new ApiError("知识点类型不存在", 404);
    if (!type.enabled) throw new ApiError("知识点类型已停用", 409);
    return type;
  }

  const rawName = input.name?.trim() || input.sheetName?.trim();
  if (!rawName) return getOrCreateDefaultKnowledgePointType(tx);

  const byName = await tx.knowledgePointType.findFirst({ where: { name: rawName } });
  if (byName) {
    if (!byName.enabled) throw new ApiError("知识点类型已停用", 409);
    return byName;
  }

  const rawCode = input.code?.trim();
  if (rawCode) {
    const code = normalizeKnowledgePointTypeCode(rawCode);
    const byCode = await tx.knowledgePointType.findUnique({ where: { code } });
    if (byCode) {
      if (!byCode.enabled) throw new ApiError("知识点类型已停用", 409);
      return byCode;
    }
  }

  const code = await getUniqueKnowledgePointTypeCode(
    tx,
    rawCode ? normalizeKnowledgePointTypeCode(rawCode) : deriveKnowledgePointTypeCode(rawName),
  );
  return tx.knowledgePointType.create({
    data: {
      code,
      name: rawName,
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
