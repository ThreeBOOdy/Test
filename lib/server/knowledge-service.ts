import "server-only";
import { ApiError } from "@/lib/domain/api-error";
import { prisma } from "@/lib/db";
import { normalizeKnowledgeCode } from "@/lib/domain/knowledge-code";

export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];


export async function ensureKnowledgePoint(
  tx: PrismaTransaction,
  rawCode: string,
  leafName?: string,
  leafSortOrder = 0,
) {
  const code = normalizeKnowledgeCode(rawCode);
  const segments = code.split(".");
  let parentId: string | null = null;
  let currentCode = "";
  let current = null as Awaited<ReturnType<typeof tx.knowledgePoint.findUnique>>;

  for (let index = 0; index < segments.length; index += 1) {
    currentCode = currentCode ? `${currentCode}.${segments[index]}` : segments[index];
    const pathCodes = segments.slice(0, index + 1).map((_, partIndex) => segments.slice(0, partIndex + 1).join("."));
    const isLeaf = index === segments.length - 1;
    const existing = await tx.knowledgePoint.findUnique({ where: { code: currentCode }, include: { _count: { select: { questions: true } } } });
    if (existing && !isLeaf && existing._count.questions > 0) {
      throw new ApiError(`知识点 ${existing.code} 已有直属题目，不能再创建下级节点`, 409);
    }
    if (existing && !existing.enabled) {
      throw new ApiError(`知识点 ${existing.code} 已停用`, 409);
    }
    current = await tx.knowledgePoint.upsert({
      where: { code: currentCode },
      update: isLeaf ? { ...(leafName?.trim() ? { name: leafName.trim() } : {}), sortOrder: leafSortOrder } : {},
      create: {
        code: currentCode,
        name: isLeaf && leafName?.trim() ? leafName.trim() : currentCode,
        parentId,
        path: `/${pathCodes.join("/")}`,
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
