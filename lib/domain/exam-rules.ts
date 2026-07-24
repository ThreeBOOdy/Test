import type { ExamRule } from "@/lib/domain/types";

export const DEFAULT_EXAM_RULES: Record<"A" | "B" | "C", ExamRule> = {
  A: { singleCount: 32, multipleCount: 8, durationMinutes: 40, passingCount: 30 },
  B: { singleCount: 45, multipleCount: 15, durationMinutes: 60, passingCount: 45 },
  C: { singleCount: 70, multipleCount: 20, durationMinutes: 90, passingCount: 70 },
};

export function validateExamRule(rule: ExamRule) {
  const total = rule.singleCount + rule.multipleCount;
  if (total <= 0) throw new Error("模拟考试题量不能为 0");
  if (rule.durationMinutes <= 0) throw new Error("考试时间必须大于 0 分钟");
  if (rule.passingCount <= 0) throw new Error("合格题数必须大于 0");
  if (rule.passingCount > total) throw new Error("合格题数不能超过试卷总题数");
  return rule;
}
