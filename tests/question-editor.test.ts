import { describe, expect, it } from "vitest";
import { normalizeKnowledgeCode } from "../lib/domain/knowledge-code";
import { normalizeQuestionEditorInput } from "../lib/domain/question-editor";

const options = [
  { id: "A", text: "选项 A" },
  { id: "B", text: "选项 B" },
  { id: "C", text: "选项 C" },
  { id: "D", text: "选项 D" },
];

describe("question editor validation", () => {
  it("infers selection specification from correct answers", () => {
    const result = normalizeQuestionEditorInput({ options, correctOptionIds: ["C", "A"] });
    expect(result.type).toBe("MULTIPLE_CHOICE");
    expect(result.selectionSpec).toBe("4选2");
    expect(result.correctOptionIds).toEqual(["A", "C"]);
  });

  it("rejects discontinuous option identifiers", () => {
    expect(() => normalizeQuestionEditorInput({ options: [options[0], options[2]], correctOptionIds: ["A"] })).toThrow("选项必须从 A 开始连续填写");
  });

  it("rejects selecting every option as correct", () => {
    expect(() => normalizeQuestionEditorInput({ options, correctOptionIds: ["A", "B", "C", "D"] })).toThrow("至少需要保留一个错误选项");
  });

  it("keeps question image markers intact in option text so edits do not drop images", () => {
    const result = normalizeQuestionEditorInput({ options: [{ id: "A", text: "请看图[图:qimg_1]" }, { id: "B", text: "干扰项" }], correctOptionIds: ["A"] });
    expect(result.options[0].text).toBe("请看图[图:qimg_1]");
  });
});

describe("knowledge code validation", () => {
  it("normalizes surrounding whitespace", () => {
    expect(normalizeKnowledgeCode(" 4.1.1 ")).toBe("4.1.1");
  });

  it("rejects empty segments and Chinese punctuation", () => {
    expect(() => normalizeKnowledgeCode("4..1")).toThrow();
    expect(() => normalizeKnowledgeCode("4。1")).toThrow();
  });
});
