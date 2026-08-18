const KNOWLEDGE_POINT_TYPE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const KNOWLEDGE_POINT_TYPE_CODE_MAX_LENGTH = 50;

export function isKnowledgePointTypeCode(value: string) {
  return KNOWLEDGE_POINT_TYPE_CODE_PATTERN.test(value.trim());
}

export function normalizeKnowledgePointTypeCode(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!KNOWLEDGE_POINT_TYPE_CODE_PATTERN.test(code)) {
    throw new Error("知识点类型代码只能包含字母、数字、横线和下划线（如 DG、TX）");
  }
  return code;
}

/**
 * 从名称生成知识点类型代码基础值（仅用于导入时“自动新建”）。
 * 中文等非拉丁字符会退化为 TYPE，具体唯一性由服务端追加序号保证。
 */
export function deriveKnowledgePointTypeCode(rawName: string) {
  const slug = rawName
    .trim()
    .toUpperCase()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (slug || "TYPE").slice(0, KNOWLEDGE_POINT_TYPE_CODE_MAX_LENGTH);
}
