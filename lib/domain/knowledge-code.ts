export function normalizeKnowledgeCode(rawCode: string) {
  const code = rawCode.trim();
  if (!code) throw new Error("分类号不能为空");
  if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(code)) {
    throw new Error("分类号只能包含字母、数字、横线、下划线和英文点号");
  }
  return code;
}