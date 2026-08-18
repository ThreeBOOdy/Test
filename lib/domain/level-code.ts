const LEVEL_CODE_PATTERN = /^[A-Za-z]+$/;

export function isLevelCode(value: string) {
  return LEVEL_CODE_PATTERN.test(value.trim());
}

export function normalizeLevelCode(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!LEVEL_CODE_PATTERN.test(code)) {
    throw new Error("字母类代码只能包含英文字母（如 A、B、C、K、AA）");
  }
  return code;
}
