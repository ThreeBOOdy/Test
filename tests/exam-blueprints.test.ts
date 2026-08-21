import { describe, expect, it } from "vitest";
import {
  allocateExamBlueprintItems,
  buildDefaultExamBlueprintInput,
  DEFAULT_EXAM_BLUEPRINT_NAME,
  validateExamBlueprint,
  validateExamBlueprintItem,
} from "@/lib/domain/exam-blueprints";

const legacyRule = {
  levelId: "level-a",
  singleCount: 32,
  multipleCount: 8,
  durationMinutes: 40,
  passingCount: 30,
  enabled: true,
};

describe("exam blueprint domain (issue #15)", () => {
  it("builds a default blueprint input from a legacy ExamRule", () => {
    expect(buildDefaultExamBlueprintInput(legacyRule, "level-a")).toEqual({
      levelId: "level-a",
      name: DEFAULT_EXAM_BLUEPRINT_NAME,
      durationMinutes: 40,
      passingCount: 30,
      enabled: true,
      isDefault: true,
    });
  });

  it("splits legacy totals proportionally across knowledge point weights and preserves totals", () => {
    const allocated = allocateExamBlueprintItems(legacyRule, [
      { knowledgePointId: "kp-1", singleWeight: 10, multipleWeight: 2 },
      { knowledgePointId: "kp-2", singleWeight: 6, multipleWeight: 6 },
    ]);

    expect(allocated).toHaveLength(2);
    expect(allocated.reduce((sum, item) => sum + item.singleCount, 0)).toBe(32);
    expect(allocated.reduce((sum, item) => sum + item.multipleCount, 0)).toBe(8);
    // 10:6 的单选权重 -> 20/12，多选 2:6 -> 2/6。
    expect(allocated.find((item) => item.knowledgePointId === "kp-1")).toMatchObject({ singleCount: 20, multipleCount: 2 });
    expect(allocated.find((item) => item.knowledgePointId === "kp-2")).toMatchObject({ singleCount: 12, multipleCount: 6 });
  });

  it("uses a single fallback item when no weights are available", () => {
    expect(allocateExamBlueprintItems({ singleCount: 10, multipleCount: 5 }, [], "kp-fallback")).toEqual([
      { knowledgePointId: "kp-fallback", singleCount: 10, multipleCount: 5 },
    ]);
  });

  it("returns no items when both counts are zero", () => {
    expect(allocateExamBlueprintItems({ singleCount: 0, multipleCount: 0 }, [], "kp-fallback")).toEqual([]);
  });

  it("validates a complete default blueprint", () => {
    const blueprint = {
      name: DEFAULT_EXAM_BLUEPRINT_NAME,
      durationMinutes: 40,
      passingCount: 30,
      enabled: true,
      isDefault: true,
      items: [
        { singleCount: 20, multipleCount: 2 },
        { singleCount: 12, multipleCount: 6 },
      ],
    };

    expect(validateExamBlueprint(blueprint)).toBe(blueprint);
    expect(validateExamBlueprintItem({ singleCount: 20, multipleCount: 2 })).toEqual({ singleCount: 20, multipleCount: 2 });
  });

  it("rejects invalid blueprints and items", () => {
    expect(() => validateExamBlueprint({ name: "  ", durationMinutes: 40, passingCount: 30, enabled: true, isDefault: true, items: [{ singleCount: 32, multipleCount: 8 }] })).toThrow("蓝图名称不能为空");
    expect(() => validateExamBlueprint({ name: "默认", durationMinutes: 0, passingCount: 30, enabled: true, isDefault: true, items: [{ singleCount: 32, multipleCount: 8 }] })).toThrow("考试时间必须大于 0 分钟");
    expect(() => validateExamBlueprint({ name: "默认", durationMinutes: 40, passingCount: 41, enabled: true, isDefault: true, items: [{ singleCount: 32, multipleCount: 8 }] })).toThrow("合格题数不能超过试卷总题数");
    expect(() => validateExamBlueprintItem({ singleCount: 0, multipleCount: 0 })).toThrow("蓝图条目题量不能为 0");
    expect(() => validateExamBlueprintItem({ singleCount: -1, multipleCount: 1 })).toThrow("单选题数量必须是非负整数");
  });
});
