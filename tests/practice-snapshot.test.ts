import { describe, expect, it } from "vitest";
import { createQuestionSnapshot, gradeQuestionSnapshot, toPublicQuestionSnapshot } from "../lib/domain/practice-snapshot";

function question() {
  return {
  id: "q-1",
  levelId: "level-a",
  knowledgePointId: "kp-1",
  stem: "原始题干",
  type: "MULTIPLE_CHOICE" as const,
  optionCount: 4,
  correctOptionCount: 2,
  selectionSpec: "4选2",
  options: [
    { id: "A", text: "选项 A" },
    { id: "B", text: "选项 B" },
    { id: "C", text: "选项 C" },
    { id: "D", text: "选项 D" },
  ],
  correctOptionIds: ["A", "C"],
  levelCode: "A",
  knowledgeName: "知识点一",
  };
}

describe("practice question snapshots", () => {
  it("copies all fields required to render and grade later", () => {
    const source = question();
    const snapshot = createQuestionSnapshot(source);
    source.options[0].text = "教师后续修改";
    source.correctOptionIds[0] = "B";

    expect(snapshot.options.find((option) => option.id === "A")?.text).toBe("选项 A");
    expect(snapshot.correctOptionIds).toEqual(["A", "C"]);
    expect(snapshot.levelCode).toBe("A");
    expect(snapshot.knowledgeName).toBe("知识点一");
  });

  it("grades against the saved answer set", () => {
    const snapshot = createQuestionSnapshot(question());
    expect(gradeQuestionSnapshot(snapshot, ["C", "A"])).toBe(true);
    expect(gradeQuestionSnapshot(snapshot, ["A", "B"])).toBe(false);
  });

  it("randomizes options once while retaining stable option identities", () => {
    const snapshot = createQuestionSnapshot(question(), () => 0);

    expect(snapshot.options.map((option) => option.id)).toEqual(["B", "C", "D", "A"]);
    expect(gradeQuestionSnapshot(snapshot, ["A", "C"])).toBe(true);
    expect(snapshot.options.map((option) => option.id)).toEqual(["B", "C", "D", "A"]);
  });

  it("preserves option order for position-dependent questions", () => {
    const snapshot = createQuestionSnapshot({ ...question(), preserveOptionOrder: true }, () => 0);

    expect(snapshot.options.map((option) => option.id)).toEqual(["A", "B", "C", "D"]);
    expect(snapshot.preserveOptionOrder).toBe(true);
  });

  it("does not disclose multiple-choice selection counts to students", () => {
    const publicQuestion = toPublicQuestionSnapshot(createQuestionSnapshot(question()));

    expect(publicQuestion).not.toHaveProperty("correctOptionIds");
    expect(publicQuestion).not.toHaveProperty("correctOptionCount");
    expect(publicQuestion).not.toHaveProperty("selectionSpec");
  });
});
