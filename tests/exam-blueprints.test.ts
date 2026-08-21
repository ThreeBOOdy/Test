import { describe, expect, it } from "vitest";
import {
  allocateExamBlueprintItems,
  BlueprintInsufficientQuestionError,
  buildDefaultExamBlueprintInput,
  DEFAULT_EXAM_BLUEPRINT_NAME,
  findExamBlueprintStockIssues,
  formatExamBlueprintStockIssue,
  selectExamBlueprintQuestions,
  validateExamBlueprint,
  validateExamBlueprintItem,
  validateExamBlueprintKnowledgePointOverlap,
} from "@/lib/domain/exam-blueprints";
import type { Question } from "@/lib/domain/types";

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

const points = [
  { id: "root", code: "1", name: "无线电基础", parentId: null },
  { id: "child-a", code: "1.1", name: "电波基础", parentId: "root" },
  { id: "child-b", code: "1.2", name: "中继台", parentId: "root" },
  { id: "grandchild", code: "1.1.1", name: "调制", parentId: "child-a" },
];

describe("exam blueprint knowledge point validation (issue #19)", () => {
  it("allows sibling knowledge points and non-overlapping branches", () => {
    expect(() =>
      validateExamBlueprintKnowledgePointOverlap(
        [
          { knowledgePointId: "child-a" },
          { knowledgePointId: "child-b" },
        ],
        points,
      ),
    ).not.toThrow();
  });

  it("rejects duplicate knowledge point selections", () => {
    expect(() =>
      validateExamBlueprintKnowledgePointOverlap(
        [
          { knowledgePointId: "child-a" },
          { knowledgePointId: "child-a" },
        ],
        points,
      ),
    ).toThrow("蓝图条目知识点不能重复");
  });

  it("rejects parent/child knowledge point overlap", () => {
    expect(() =>
      validateExamBlueprintKnowledgePointOverlap(
        [
          { knowledgePointId: "root" },
          { knowledgePointId: "child-a" },
        ],
        points,
      ),
    ).toThrow("蓝图条目知识点存在父子重叠");
  });

  it("rejects ancestor/grandchild knowledge point overlap", () => {
    expect(() =>
      validateExamBlueprintKnowledgePointOverlap(
        [
          { knowledgePointId: "root" },
          { knowledgePointId: "grandchild" },
        ],
        points,
      ),
    ).toThrow("蓝图条目知识点存在父子重叠");
  });

  it("rejects unknown knowledge points", () => {
    expect(() =>
      validateExamBlueprintKnowledgePointOverlap(
        [{ knowledgePointId: "missing" }],
        points,
      ),
    ).toThrow("知识点不存在");
  });
});

describe("exam blueprint inventory validation (issue #19)", () => {
  const pointById = new Map([
    ["kp-1", { id: "kp-1", code: "1.1", name: "电波基础" }],
    ["kp-2", { id: "kp-2", code: "2.1", name: "中继台" }],
  ]);

  it("finds single/multiple stock shortages with required and available counts", () => {
    const issues = findExamBlueprintStockIssues(
      [
        { knowledgePointId: "kp-1", singleCount: 10, multipleCount: 2 },
        { knowledgePointId: "kp-2", singleCount: 0, multipleCount: 5 },
      ],
      new Map([
        ["kp-1", { singleCount: 8, multipleCount: 3 }],
        ["kp-2", { singleCount: 0, multipleCount: 5 }],
      ]),
      pointById,
    );

    expect(issues).toEqual([
      {
        knowledgePointId: "kp-1",
        knowledgePointCode: "1.1",
        knowledgePointName: "电波基础",
        questionType: "SINGLE_CHOICE",
        required: 10,
        available: 8,
      },
    ]);
  });

  it("formats a stock shortage message with point, type and missing quantity", () => {
    const message = formatExamBlueprintStockIssue({
      knowledgePointId: "kp-1",
      knowledgePointCode: "1.1",
      knowledgePointName: "电波基础",
      questionType: "MULTIPLE_CHOICE",
      required: 5,
      available: 2,
    });

    expect(message).toContain("电波基础");
    expect(message).toContain("多选");
    expect(message).toContain("需要 5 题");
    expect(message).toContain("当前仅 2 题");
    expect(message).toContain("缺少 3 题");
  });
});

function blueprintQuestion(id: string, type: Question["type"]): Question {
  const options = type === "SINGLE_CHOICE"
    ? [{ id: "A", text: "A" }, { id: "B", text: "B" }]
    : [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }];
  return {
    id,
    levelIds: ["level-a"],
    knowledgePointId: "kp-1",
    stem: `Question ${id}`,
    type,
    optionCount: options.length,
    correctOptionCount: type === "SINGLE_CHOICE" ? 1 : 2,
    selectionSpec: type === "SINGLE_CHOICE" ? "2选1" : "3选2",
    options,
    correctOptionIds: type === "SINGLE_CHOICE" ? ["A"] : ["A", "C"],
    status: "ACTIVE",
  };
}

describe("exam blueprint mock exam drawing (issue #18)", () => {
  it("draws each item's requested counts uniformly from its own pools and shuffles the final paper", () => {
    const items = [
      {
        knowledgePointId: "kp-1",
        knowledgePointName: "电工基础",
        singleCount: 2,
        multipleCount: 1,
        singlePool: [blueprintQuestion("s1", "SINGLE_CHOICE"), blueprintQuestion("s2", "SINGLE_CHOICE"), blueprintQuestion("s3", "SINGLE_CHOICE")],
        multiplePool: [blueprintQuestion("m1", "MULTIPLE_CHOICE"), blueprintQuestion("m2", "MULTIPLE_CHOICE")],
      },
      {
        knowledgePointId: "kp-2",
        knowledgePointName: "通信原理",
        singleCount: 1,
        multipleCount: 1,
        singlePool: [blueprintQuestion("s4", "SINGLE_CHOICE")],
        multiplePool: [blueprintQuestion("m3", "MULTIPLE_CHOICE")],
      },
    ];

    const selected = selectExamBlueprintQuestions(items, () => 0.42);

    expect(selected).toHaveLength(5);
    expect(selected.filter((question) => question.type === "SINGLE_CHOICE")).toHaveLength(3);
    expect(selected.filter((question) => question.type === "MULTIPLE_CHOICE")).toHaveLength(2);
    expect(new Set(selected.map((question) => question.id)).size).toBe(5);
  });

  it("reports the exact knowledge point, type, and missing count when inventory is insufficient", () => {
    expect(() => selectExamBlueprintQuestions([
      {
        knowledgePointId: "kp-1",
        knowledgePointName: "电工基础",
        singleCount: 2,
        multipleCount: 0,
        singlePool: [blueprintQuestion("s1", "SINGLE_CHOICE")],
        multiplePool: [],
      },
    ])).toThrowError(BlueprintInsufficientQuestionError);

    try {
      selectExamBlueprintQuestions([
        {
          knowledgePointId: "kp-1",
          knowledgePointName: "电工基础",
          singleCount: 2,
          multipleCount: 0,
          singlePool: [blueprintQuestion("s1", "SINGLE_CHOICE")],
          multiplePool: [],
        },
      ]);
      throw new Error("expected selectExamBlueprintQuestions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BlueprintInsufficientQuestionError);
      if (!(error instanceof BlueprintInsufficientQuestionError)) throw error;
      expect(error.message).toContain("电工基础");
      expect(error.message).toContain("单选题库存不足");
      expect(error.required).toBe(2);
      expect(error.available).toBe(1);
    }
  });
});
