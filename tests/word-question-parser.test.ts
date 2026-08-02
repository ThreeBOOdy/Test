import { describe, expect, it } from "vitest";
import { parseWordQuestions } from "../lib/domain/word-question-parser";
import { validateImportRow } from "../lib/domain/question-import";

describe("word question parser", () => {
  it("skips template instructions before the first question number and ignores empty lines", () => {
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions([
      "1. 题干一",
      "2、题干二",
      "（3）题干三",
      "(4)题干四",
      "5．题干五",
    ]);

    expect(rows.map((row) => row.locationLabel)).toEqual(["第 1 题", "第 2 题", "第 3 题", "第 4 题", "第 5 题"]);
    expect(rows.map((row) => row.rowNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("leaves worksheet name and question code empty for word rows", () => {
    const rows = parseWordQuestions(["1. 题干", "A、选项A", "B、选项B", "答案：A"]);

    expect(rows[0].sheetName).toBeUndefined();
    expect(rows[0].externalQuestionCode).toBeUndefined();
    expect(rows[0].levelCode).toBe("");
    expect(rows[0].categoryCode).toBe("");
  });

  it("parses options in order A–H, normalizing case and supporting common separators", () => {
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions(["1. 第一行题干", "  缩进的第二行题干", "A、选项A", "B、选项B", "答案：A"]);

    expect(rows[0].stem).toBe("第一行题干\n  缩进的第二行题干");
  });

  it("parses non-empty answer lines with common separators", () => {
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions(["1. 题干（A）", "A、选项A", "B、选项B", "答案："]);

    expect(rows[0]).toMatchObject({ stem: "题干（A）", rawAnswer: "" });
  });

  it("merges explanation lines until the next question number or block end", () => {
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions([
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
    const rows = parseWordQuestions(["1.", "[不定项选择题]题干", "A、选项A", "B、选项B", "答案：A"]);

    expect(rows).toHaveLength(1);
    expect(rows[0].stem).toBe("题干");
  });

  it("decides single vs multiple choice by answer count through the existing rule", () => {
    const single = parseWordQuestions(["1. 题干", "A、选项A", "B、选项B", "答案：A"])[0];
    const multiple = parseWordQuestions(["2. 题干", "A、选项A", "B、选项B", "答案：AB"])[0];

    expect(validateImportRow(single).type).toBe("SINGLE_CHOICE");
    expect(validateImportRow(multiple).type).toBe("MULTIPLE_CHOICE");
  });
});
