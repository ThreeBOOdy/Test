const KNOWLEDGE_POINT_TYPE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

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
