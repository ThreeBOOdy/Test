import { describe, expect, it } from "vitest";
import { canConfigureKnowledgeRule, getKnowledgeRuleInventory } from "@/lib/domain/knowledge-rules";

describe("knowledge practice rules", () => {
  const points = [
    { id: "parent", parentId: null, depth: 1, enabled: true },
    { id: "leaf", parentId: "parent", depth: 2, enabled: true },
    { id: "deep-leaf", parentId: "parent", depth: 3, enabled: true },
    { id: "disabled-leaf", parentId: "parent", depth: 2, enabled: false },
  ];

  it("allows enabled leaf points at any depth", () => {
    expect(canConfigureKnowledgeRule(points, "leaf")).toBe(true);
    expect(canConfigureKnowledgeRule(points, "deep-leaf")).toBe(true);
    expect(canConfigureKnowledgeRule(points, "parent")).toBe(false);
    expect(canConfigureKnowledgeRule(points, "disabled-leaf")).toBe(false);
  });

  it("counts active question inventory for a level and leaf", () => {
    expect(getKnowledgeRuleInventory([
      { levelId: "level-a", knowledgePointId: "leaf", type: "SINGLE_CHOICE", status: "ACTIVE" },
      { levelId: "level-a", knowledgePointId: "leaf", type: "MULTIPLE_CHOICE", status: "ACTIVE" },
      { levelId: "level-a", knowledgePointId: "leaf", type: "SINGLE_CHOICE", status: "DISABLED" },
    ], "level-a", "leaf")).toEqual({ singleCount: 1, multipleCount: 1 });
  });
});
