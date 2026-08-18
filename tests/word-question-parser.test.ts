import { describe, expect, it } from "vitest";
import { parseWordQuestions } from "../lib/domain/word-question-parser";
import { validateImportRow } from "../lib/domain/question-import";

describe("word question parser", () => {
  it("skips template instructions before the first question number and ignores empty lines", () => {
    const { rows } = parseWordQuestions([
      "导入说明：本模板用于批量导入选择题。",
      "每个题型必须写题号，答案不能为空。",
      "",
      "1. 下列关于力的说法正确的是",
      "A、方向",
      "B、大小",
      "答案：A",
      "",
      "2、下列关于速度的说法正确的是",
      "A、位移",
      "B、时间",
      "答案：B",
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rowNumber: 1, locationLabel: "第 1 题", stem: "下列关于力的说法正确的是", rawAnswer: "A" });
    expect(rows[1]).toMatchObject({ rowNumber: 2, locationLabel: "第 2 题", stem: "下列关于速度的说法正确的是", rawAnswer: "B" });
  });

  it("supports the three question-number formats with full/half-width parens", () => {
    const { rows } = parseWordQuestions([
      "1. 题干一",
      "A、选项A",
      "B、选项B",
      "答案：A",
      "2、题干二",
      "A、选项A",
      "B、选项B",
      "答案：B",
      "（3）题干三",
      "A、选项A",
      "B、选项B",
      "答案：A",
      "(4)题干四",
      "A、选项A",
      "B、选项B",
      "答案：B",
      "5．题干五",
      "A、选项A",
      "B、选项B",
      "答案：A",
    ]);

    expect(rows.map((row) => row.locationLabel)).toEqual(["第 1 题", "第 2 题", "第 3 题", "第 4 题", "第 5 题"]);
    expect(rows.map((row) => row.rowNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("leaves worksheet name and question code empty for word rows", () => {
    const { rows } = parseWordQuestions(["1. 题干", "A、选项A", "B、选项B", "答案：A"]);

    expect(rows[0].sheetName).toBeUndefined();
    expect(rows[0].externalQuestionCode).toBeUndefined();
    expect(rows[0].categoryCode).toBe("");
  });

  it("parses options in order A–H, normalizing case and supporting common separators", () => {
    const { rows } = parseWordQuestions([
      "1. 题干",
      "a、小写选项",
      "B. 点号选项",
      "c．全角点选项",
      "D: 冒号选项",
      "E：全角冒号选项",
      "F 空格选项",
      "G、选项G",
      "H、选项H",
      "答案：A",
    ]);

    expect(rows[0].optionValues).toEqual({
      A: "小写选项",
      B: "点号选项",
      C: "全角点选项",
      D: "冒号选项",
      E: "全角冒号选项",
      F: "空格选项",
      G: "选项G",
      H: "选项H",
    });
  });

  it("tolerates leading whitespace on answer, option, and explanation markers", () => {
    const { rows } = parseWordQuestions([
      "1. 题干",
      "\tA、选项A",
      "  B. 选项B",
      "  答案：A",
      "\t解析：换行前的解释",
      "  解析继续",
    ]);

    expect(rows[0]).toMatchObject({
      stem: "题干",
      rawAnswer: "A",
      explanation: "换行前的解释\n  解析继续",
      optionValues: { A: "选项A", B: "选项B" },
    });
  });

  it("keeps multiline stems joined with newlines", () => {
    const { rows } = parseWordQuestions(["1. 第一行题干", "  缩进的第二行题干", "A、选项A", "B、选项B", "答案：A"]);

    expect(rows[0].stem).toBe("第一行题干\n  缩进的第二行题干");
  });

  it("parses non-empty answer lines with common separators", () => {
    const { rows } = parseWordQuestions([
      "1. 题干",
      "A、选项A",
      "B、选项B",
      "C、选项C",
      "答案：A、C",
      "2. 题干二",
      "A、选项A",
      "B、选项B",
      "答案:a c",
    ]);

    expect(rows[0].rawAnswer).toBe("A、C");
    expect(rows[1].rawAnswer).toBe("a c");
  });

  it("extracts a parenthetical answer at the stem end and removes it", () => {
    const { rows } = parseWordQuestions([
      "1. 题干（A）",
      "A、选项A",
      "B、选项B",
      "2. 题干二（A,C）",
      "A、选项A",
      "B、选项B",
      "C、选项C",
      "3. 题干三(a c)",
      "A、选项A",
      "B、选项B",
      "C、选项C",
    ]);

    expect(rows[0]).toMatchObject({ stem: "题干", rawAnswer: "A" });
    expect(rows[1]).toMatchObject({ stem: "题干二", rawAnswer: "A,C" });
    expect(rows[2]).toMatchObject({ stem: "题干三", rawAnswer: "a c" });
  });

  it("does not extract empty parens, non-letter parens, or parens when an answer line exists", () => {
    const { rows } = parseWordQuestions([
      "1. 题干（）",
      "A、选项A",
      "B、选项B",
      "2. 题干（选择正确项）",
      "A、选项A",
      "B、选项B",
      "3. 题干（A）",
      "A、选项A",
      "B、选项B",
      "答案：B",
    ]);

    expect(rows[0]).toMatchObject({ stem: "题干（）", rawAnswer: "" });
    expect(rows[1]).toMatchObject({ stem: "题干（选择正确项）", rawAnswer: "" });
    expect(rows[2]).toMatchObject({ stem: "题干（A）", rawAnswer: "B" });
  });

  it("treats an empty answer line as an answer line and skips parenthetical fallback", () => {
    const { rows } = parseWordQuestions(["1. 题干（A）", "A、选项A", "B、选项B", "答案："]);

    expect(rows[0]).toMatchObject({ stem: "题干（A）", rawAnswer: "" });
  });

  it("merges explanation lines until the next question number or block end", () => {
    const { rows } = parseWordQuestions([
      "1. 题干",
      "A、选项A",
      "B、选项B",
      "答案：A",
      "解析：第一步判断方向。",
      "第二步结合受力分析。",
      "2. 下一题题干",
      "A、选项A",
      "B、选项B",
      "答案：B",
    ]);

    expect(rows[0].explanation).toBe("第一步判断方向。\n第二步结合受力分析。");
    expect(rows[0].stem).toBe("题干");
    expect(rows[1].explanation).toBeUndefined();
  });

  it("ends explanation at the next option or answer field marker", () => {
    const { rows } = parseWordQuestions([
      "1. 题干",
      "A、选项A",
      "解析：先看选项，再看答案。",
      "B、选项B",
      "答案：A",
    ]);

    expect(rows[0].explanation).toBe("先看选项，再看答案。");
    expect(rows[0].optionValues).toEqual({ A: "选项A", B: "选项B" });
    expect(rows[0].rawAnswer).toBe("A");
  });

  it("supports all three indeterminate annotations and strips them from the stem", () => {
    const { rows } = parseWordQuestions([
      "1. [不定项选择题] 题干一",
      "A、选项A",
      "B、选项B",
      "C、选项C",
      "答案：AB",
      "2、[不定项选项题]题干二",
      "A、选项A",
      "B、选项B",
      "答案：A",
      "（3）[不定项] 题干三",
      "A、选项A",
      "B、选项B",
      "C、选项C",
      "答案：C",
    ]);

    expect(rows.map((row) => row.stem)).toEqual(["题干一", "题干二", "题干三"]);
    expect(rows.map((row) => row.locationLabel)).toEqual(["第 1 题", "第 2 题", "第 3 题"]);
  });

  it("accepts an annotation on the line after the question number", () => {
    const { rows } = parseWordQuestions(["1.", "[不定项选择题]题干", "A、选项A", "B、选项B", "答案：A"]);

    expect(rows).toHaveLength(1);
    expect(rows[0].stem).toBe("题干");
  });

  it("decides single vs multiple choice by answer count through the existing rule", () => {
    const single = parseWordQuestions(["1. 题干", "A、选项A", "B、选项B", "答案：A"]).rows[0];
    const multiple = parseWordQuestions(["2. 题干", "A、选项A", "B、选项B", "答案：AB"]).rows[0];

    expect(validateImportRow(single).type).toBe("SINGLE_CHOICE");
    expect(validateImportRow(multiple).type).toBe("MULTIPLE_CHOICE");
  });
});

describe("word parser unsupported types and block errors", () => {
  it("rejects judgment questions with 对/错/正确/错误 answers one by one with location", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 判断：力是维持运动的原因。",
      "答案：正确",
      "2. 判断二",
      "答案：错误",
      "3. 判断三",
      "答案：对",
      "4. 判断四",
      "答案：错",
    ]);

    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(4);
    expect(errors.map((error) => error.locationLabel)).toEqual(["第 1 题", "第 2 题", "第 3 题", "第 4 题"]);
    expect(errors.map((error) => error.rowNumber)).toEqual([1, 2, 3, 4]);
    expect(errors.every((error) => error.message === "判断题暂不支持导入")).toBe(true);
  });

  it("rejects fill-in-the-blank questions when the stem has blank parens and the answer uses separators", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 力与运动的关系是（）。",
      "答案：惯性|质量",
      "2. 光在真空中的传播速度是（ ）。",
      "答案：3×10^8；真空中",
    ]);

    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(errors.map((error) => error.locationLabel)).toEqual(["第 1 题", "第 2 题"]);
    expect(errors.every((error) => error.message === "填空题暂不支持导入")).toBe(true);
  });

  it("rejects short-answer and essay questions without options", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 简述牛顿第一定律的内容。",
      "答案：任何物体在不受外力作用时，总保持匀速直线运动状态或静止状态。",
      "2. 论述题：请论述能量守恒的意义。",
    ]);

    expect(rows).toHaveLength(0);
    expect(errors.map((error) => error.message)).toEqual(["简答题暂不支持导入", "简答题暂不支持导入"]);
    expect(errors.map((error) => error.locationLabel)).toEqual(["第 1 题", "第 2 题"]);
  });

  it("treats a stem with blank parens but no answer separator as a short-answer question", () => {
    const { rows, errors } = parseWordQuestions(["1. 单个空位是（）。", "答案：惯性"]);

    expect(rows).toHaveLength(0);
    expect(errors).toEqual([
      expect.objectContaining({ locationLabel: "第 1 题", message: "简答题暂不支持导入" }),
    ]);
  });

  it("rejects a material block from [材料题] to [材料题结束] as one error and keeps inner sub-questions intact", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 下列判断正确的一项是",
      "A、选项A",
      "B、选项B",
      "答案：A",
      "2. [材料题] 阅读下面的材料",
      "材料一：……",
      "（1）小题一",
      "（2）小题二",
      "[材料题结束]",
      "3. 正常选择题",
      "A、选项A",
      "B、选项B",
      "答案：B",
    ]);

    expect(rows.map((row) => row.locationLabel)).toEqual(["第 1 题", "第 3 题"]);
    expect(errors).toEqual([
      expect.objectContaining({ locationLabel: "第 2 题", message: "材料题暂不支持导入" }),
    ]);
  });

  it("rejects an unterminated material block through the document end without splitting its lines", () => {
    const { rows, errors } = parseWordQuestions([
      "1. [材料题] 阅读材料",
      "（1）小题一",
      "（2）小题二",
      "2. 本行也是材料的一部分",
    ]);

    expect(rows).toHaveLength(0);
    expect(errors).toEqual([
      expect.objectContaining({ locationLabel: "第 1 题", message: "材料题暂不支持导入" }),
    ]);
  });

  it("detects a material annotation on the line after the question number", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 阅读材料并作答",
      "[材料题]",
      "材料正文……",
      "（1）小题",
      "[材料题结束]",
    ]);

    expect(rows).toHaveLength(0);
    expect(errors).toEqual([
      expect.objectContaining({ locationLabel: "第 1 题", message: "材料题暂不支持导入" }),
    ]);
  });

  it("rejects questions with more than eight options and explains the system limit", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 选项超限题",
      "A、选项A",
      "B、选项B",
      "C、选项C",
      "D、选项D",
      "E、选项E",
      "F、选项F",
      "G、选项G",
      "H、选项H",
      "I、选项I",
      "答案：A",
      "2. 正常选择题",
      "A、选项A",
      "B、选项B",
      "答案：B",
    ]);

    expect(rows.map((row) => row.locationLabel)).toEqual(["第 2 题"]);
    expect(errors).toEqual([
      expect.objectContaining({ locationLabel: "第 1 题", message: "系统最多支持 8 个选项" }),
    ]);
  });

  it("keeps valid choice questions importable next to rejected ones", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 选择题一",
      "A、选项A",
      "B、选项B",
      "答案：A",
      "2. 判断题",
      "答案：正确",
      "3. 选择题二",
      "A、选项A",
      "B、选项B",
      "答案：B",
    ]);

    expect(errors).toEqual([
      expect.objectContaining({ rowNumber: 2, locationLabel: "第 2 题", message: "判断题暂不支持导入" }),
    ]);
    expect(rows.map((row) => row.locationLabel)).toEqual(["第 1 题", "第 3 题"]);
    expect(rows.map((row) => row.rowNumber)).toEqual([1, 3]);

    const validated = rows.map((row) => validateImportRow({ ...row, categoryCode: "4.1.1" }));
    expect(validated.every((item) => item.issues.every((issue) => issue.severity !== "error"))).toBe(true);
  });

  it("flags missing answers as locatable validation errors", () => {
    const { rows, errors } = parseWordQuestions([
      "1. 缺少答案的选择题",
      "A、选项A",
      "B、选项B",
      "2. 空答案行的选择题",
      "A、选项A",
      "B、选项B",
      "答案：",
    ]);

    expect(errors).toHaveLength(0);
    expect(rows.map((row) => row.locationLabel)).toEqual(["第 1 题", "第 2 题"]);
    expect(rows.every((row) => row.rawAnswer === "")).toBe(true);
    for (const row of rows) {
      const validated = validateImportRow({ ...row, categoryCode: "4.1.1" });
      expect(validated.issues).toContainEqual(expect.objectContaining({ severity: "error", field: "答案", message: "答案不能为空" }));
    }
  });

  it("throws when the document has no question numbers", () => {
    expect(() => parseWordQuestions(["导入说明：本模板用于批量导入选择题。", "每个题型必须写题号。"])).toThrow("未找到题目");
    expect(() => parseWordQuestions([])).toThrow("未找到题目");
    expect(() => parseWordQuestions(["", "   "])).toThrow("未找到题目");
  });
});
