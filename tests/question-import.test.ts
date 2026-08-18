import { describe, expect, it } from "vitest";
import { classifyImportDuplicate, findBatchDuplicateRows, importRowLocation, normalizeAnswer, validateImportRow } from "../lib/domain/question-import";
import type { ImportQuestionRow } from "../lib/domain/types";

function row(overrides: Partial<ImportQuestionRow> = {}): ImportQuestionRow {
  return { rowNumber: 2, sheetName: "题库", categoryCode: "4.1.1", externalQuestionCode: "MC2-0916", stem: "测试题目", rawAnswer: "AC", declaredSelectionSpec: "4选2", optionValues: { A: "选项A", B: "选项B", C: "选项C", D: "选项D" }, ...overrides };
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

  it("does not require a letter class on imported rows", () => {
    const result = validateImportRow(row());
    expect(result.issues.some((issue) => issue.field === "等级")).toBe(false);
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

  it("distinguishes exact duplicates, code conflicts, and unnumbered suspects", () => {
    const candidate = validateImportRow(row());
    const comparable = { ...candidate.row, options: candidate.options, correctOptionIds: candidate.correctOptionIds };

    expect(classifyImportDuplicate(comparable, comparable)).toBe("EXACT");
    expect(classifyImportDuplicate(comparable, { ...comparable, stem: "不同题干" })).toBe("CONFLICT");
    expect(classifyImportDuplicate({ ...comparable, externalQuestionCode: "" }, { ...comparable, externalQuestionCode: null })).toBe("SUSPECT");
  });

  it("blocks duplicates across worksheets even when source row numbers match", () => {
    const first = validateImportRow(row({ sheetName: "题库一", rowNumber: 2, externalQuestionCode: "Q-1" }));
    const duplicate = validateImportRow(row({ sheetName: "题库二", rowNumber: 2, externalQuestionCode: "Q-1" }));

    expect(findBatchDuplicateRows([first, duplicate])).toEqual(new Map([["题库二!2", "题库一!2"]]));
  });

  it("treats externalQuestionCode as a global identity key across categories and types", () => {
    const first = validateImportRow(row({ sheetName: "电工", categoryCode: "4.1.1", externalQuestionCode: "GLOBAL-1" }));
    const duplicate = validateImportRow(row({ sheetName: "通信", categoryCode: "1.1", externalQuestionCode: "GLOBAL-1" }));

    expect(findBatchDuplicateRows([first, duplicate])).toEqual(new Map([["通信!2", "电工!2"]]));
  });

  it("prioritizes the Word location label for row locations", () => {
    expect(importRowLocation({ rowNumber: 3, locationLabel: "第 1 题" })).toBe("第 1 题");
    expect(importRowLocation({ rowNumber: 3, sheetName: "题库", locationLabel: "第 1 题" })).toBe("第 1 题");
    expect(importRowLocation({ rowNumber: 3, sheetName: "题库" })).toBe("题库!3");
    expect(importRowLocation({ rowNumber: 3 })).toBe("第 3 行");
  });

  it("reports batch duplicates with Word location labels", () => {
    const first = validateImportRow(row({ rowNumber: 1, locationLabel: "第 1 题", externalQuestionCode: "" }));
    const duplicate = validateImportRow(row({ rowNumber: 2, locationLabel: "第 2 题", externalQuestionCode: "" }));

    expect(findBatchDuplicateRows([first, duplicate])).toEqual(new Map([["第 2 题", "第 1 题"]]));
  });

  it("treats identical image content with different marker ids as the same content", () => {
    const hashById = (id: string) => (id === "qimg_1" || id === "qimg_2" ? "same-image-hash" : undefined);
    const candidate = validateImportRow(row({ stem: "题干 [图:qimg_1]", optionValues: { A: "A [图:qimg_2]", B: "B" } }));
    const existing = validateImportRow(row({ stem: "题干 [图:qimg_2]", optionValues: { A: "A [图:qimg_1]", B: "B" } }));
    const candidateComparable = { ...candidate.row, options: candidate.options, correctOptionIds: candidate.correctOptionIds };
    const existingComparable = { ...existing.row, options: existing.options, correctOptionIds: existing.correctOptionIds };

    expect(classifyImportDuplicate(candidateComparable, existingComparable, hashById, hashById)).toBe("EXACT");
    expect(classifyImportDuplicate({ ...candidateComparable, externalQuestionCode: "" }, { ...existingComparable, externalQuestionCode: null }, hashById, hashById)).toBe("SUSPECT");
  });

  it("treats different image bytes as different content even when markers differ", () => {
    const candidateHash = (id: string) => (id === "qimg_1" ? "hash-a" : undefined);
    const existingHash = (id: string) => (id === "qimg_2" ? "hash-b" : undefined);
    const candidate = validateImportRow(row({ stem: "题干 [图:qimg_1]" }));
    const existing = validateImportRow(row({ stem: "题干 [图:qimg_2]" }));
    const candidateComparable = { ...candidate.row, options: candidate.options, correctOptionIds: candidate.correctOptionIds };
    const existingComparable = { ...existing.row, options: existing.options, correctOptionIds: existing.correctOptionIds };

    expect(classifyImportDuplicate(candidateComparable, existingComparable, candidateHash, existingHash)).toBe("CONFLICT");
    expect(classifyImportDuplicate({ ...candidateComparable, externalQuestionCode: "" }, { ...existingComparable, externalQuestionCode: null }, candidateHash, existingHash)).toBeNull();
  });

  it("finds batch duplicates by image content hash instead of marker id", () => {
    const hashById = (id: string) => (id === "qimg_1" || id === "qimg_2" ? "same-image-hash" : undefined);
    const first = validateImportRow(row({ rowNumber: 1, locationLabel: "第 1 题", externalQuestionCode: "", stem: "题干 [图:qimg_1]" }));
    const duplicate = validateImportRow(row({ rowNumber: 2, locationLabel: "第 2 题", externalQuestionCode: "", stem: "题干 [图:qimg_2]" }));

    expect(findBatchDuplicateRows([first, duplicate], hashById)).toEqual(new Map([["第 2 题", "第 1 题"]]));
  });

  it("does not flag batch rows whose image bytes differ", () => {
    const hashById = (id: string) => (id === "qimg_1" ? "hash-a" : id === "qimg_2" ? "hash-b" : undefined);
    const first = validateImportRow(row({ rowNumber: 1, locationLabel: "第 1 题", externalQuestionCode: "", stem: "题干 [图:qimg_1]" }));
    const different = validateImportRow(row({ rowNumber: 2, locationLabel: "第 2 题", externalQuestionCode: "", stem: "题干 [图:qimg_2]" }));

    expect(findBatchDuplicateRows([first, different], hashById)).toEqual(new Map());
  });
});
