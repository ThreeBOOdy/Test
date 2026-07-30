export const RADIO_PERSON_CATALOG = Array.from({ length: 120 }, (_, index) => {
  const sequence = String(index + 1).padStart(3, "0");
  return {
    id: `radio-person-${sequence}`,
    username: `radio-${sequence}`,
    name: `无线电贡献者 ${sequence}`,
    profile: `无线电人物目录第 ${sequence} 位贡献者，用于学生完成实名资料后选择独立且不可变的练习身份。`,
    resourceStatus: "AVAILABLE" as const,
  };
});