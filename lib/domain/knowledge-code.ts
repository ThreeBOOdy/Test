const KNOWLEDGE_CODE_SEGMENT_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const KNOWLEDGE_CODE_SEPARATOR_PATTERN = /[./]/;

export function normalizeKnowledgeCode(rawCode: string) {
  const code = rawCode.trim();
  if (!code) throw new Error("分类号不能为空");
  const segments = code.split(KNOWLEDGE_CODE_SEPARATOR_PATTERN);
  if (segments.some((segment) => !KNOWLEDGE_CODE_SEGMENT_PATTERN.test(segment))) {
    throw new Error("分类号只能包含字母、数字、中文、横线、下划线，并用英文点号或斜杠分隔层级");
  }
  return code;
}

export function splitKnowledgeCode(code: string) {
  return code.split(KNOWLEDGE_CODE_SEPARATOR_PATTERN);
}

export function getKnowledgeCodePrefixes(code: string) {
  const prefixes: string[] = [];
  let current = "";
  for (const char of code) {
    current += char;
    if (char === "." || char === "/") prefixes.push(current.slice(0, -1));
  }
  prefixes.push(code);
  return prefixes;
}