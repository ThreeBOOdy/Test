import { describe, expect, it } from "vitest";
import { DEFAULT_EXAM_RULES, validateExamRule } from "@/lib/domain/exam-rules";

describe("exam rules", () => {
  it("matches the default A, B and C certification standards", () => {
    expect(DEFAULT_EXAM_RULES).toEqual({
      A: { singleCount: 32, multipleCount: 8, durationMinutes: 40, passingCount: 30 },
      B: { singleCount: 45, multipleCount: 15, durationMinutes: 60, passingCount: 45 },
      C: { singleCount: 70, multipleCount: 20, durationMinutes: 90, passingCount: 70 },
    });
  });

  it("rejects passing scores above the total question count", () => {
    expect(() => validateExamRule({ singleCount: 10, multipleCount: 5, durationMinutes: 30, passingCount: 16 })).toThrow("合格题数不能超过试卷总题数");
  });
});
