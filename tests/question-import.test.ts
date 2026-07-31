import { describe, expect, it } from "vitest";
import { normalizeAnswer, validateImportRow } from "../lib/domain/question-import";
import type { ImportQuestionRow } from "../lib/domain/types";

function row(overrides: Partial<ImportQuestionRow> = {}): ImportQuestionRow {
  return { rowNumber: 2, sheetName: "题库", levelCode: "A", categoryCode: "4.1.1", externalQuestionCode: "MC2-0916", stem: "测试题目", rawAnswer: "AC", declaredSelectionSpec: "4选2", optionValues: { A: "选项A", B: "选项B", C: "选项C", D: "选项D" }, ...overrides };
}

describe("question import validation", () => {
  it("normalizes common answer separators", () => {
    expect(normalizeAnswer("A、C")).toEqual(["A", "C"]);
    expect(normalizeAnswer("A,C")).toEqual(["A", "C"]);
    expect(normalizeAnswer("AC")).toEqual(["A", "C"]);
    expect(normalizeAnswer("A C")).toEqual(["A", "C"]);
  });

  it("infers question type and selection spec", () => {
    const result = validateImportRow(row());
    expect(result.type).toBe("MULTIPLE_CHOICE");
    expect(result.selectionSpec).toBe("4选2");
    expect(result.issues).toHaveLength(0);
  });

  it("rejects mismatched declared specification", () => {
    const result = validateImportRow(row({ declaredSelectionSpec: "4选3" }));
    expect(result.issues.some((issue) => issue.severity === "error" && issue.field === "选项规格")).toBe(true);
  });

  it("warns when MC code conflicts with answer count", () => {
    const result = validateImportRow(row({ externalQuestionCode: "MC3-0916" }));
    expect(result.issues.some((issue) => issue.severity === "warning")).toBe(true);
  });

  it("keeps worksheet source in the validated row", () => {
    expect(validateImportRow(row({ sheetName: "模拟考试" })).row.sheetName).toBe("模拟考试");
  });

  it("warns about position-dependent wording unless option order is locked", () => {
    const risky = validateImportRow(row({ stem: "下列选项中，第一项正确的是？" }));
    const locked = validateImportRow(row({ stem: "下列选项中，第一项正确的是？", preserveOptionOrder: true }));

    expect(risky.issues).toContainEqual(expect.objectContaining({ severity: "warning", field: "题干" }));
    expect(locked.issues).not.toContainEqual(expect.objectContaining({ field: "题干" }));
  });
});
