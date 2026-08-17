import { describe, expect, it } from "vitest";
import { decorateKnowledgeMap, deriveKnowledgeMapStatus } from "@/lib/domain/knowledge-map";
import type { KnowledgePoint } from "@/lib/domain/types";

const points: KnowledgePoint[] = [
  { id: "kp-1", code: "1", name: "无线电基础", parentId: null, path: "/1", depth: 0, sortOrder: 0, enabled: true },
  { id: "kp-1-1", code: "1.1", name: "电波基础", parentId: "kp-1", path: "/1/1", depth: 1, sortOrder: 0, enabled: true },
  { id: "kp-1-2", code: "1.2", name: "中继台", parentId: "kp-1", path: "/1/2", depth: 1, sortOrder: 1, enabled: true },
];

describe("knowledge map domain", () => {
  it("derives unvisited, weak and mastered statuses from stats", () => {
    expect(deriveKnowledgeMapStatus({ answered: 0, correct: 0, hasUnmasteredWrong: false })).toBe("unvisited");
    expect(deriveKnowledgeMapStatus({ answered: 10, correct: 9, hasUnmasteredWrong: true })).toBe("weak");
    expect(deriveKnowledgeMapStatus({ answered: 10, correct: 5, hasUnmasteredWrong: false })).toBe("weak");
    expect(deriveKnowledgeMapStatus({ answered: 3, correct: 3, hasUnmasteredWrong: false })).toBe("mastered");
    expect(deriveKnowledgeMapStatus({ answered: 2, correct: 2, hasUnmasteredWrong: false })).toBe("weak");
  });

  it("decorates the tree with aggregated stats and summary counts", () => {
    const statsById = new Map([
      ["kp-1-1", { answered: 4, correct: 4, hasUnmasteredWrong: false }],
      ["kp-1-2", { answered: 2, correct: 1, hasUnmasteredWrong: false }],
    ]);
    const practiceHrefs = new Map([["kp-1-2", "/student/practice/start?mode=knowledge&level=A&knowledge=kp-1-2"]]);

    const map = decorateKnowledgeMap(points, statsById, practiceHrefs, true);

    expect(map.stats).toEqual({ total: 3, mastered: 2, weak: 1, unvisited: 0 });
    expect(map.mapEnabled).toBe(true);

    const root = map.nodes[0];
    expect(root.answered).toBe(6);
    expect(root.correct).toBe(5);
    expect(root.accuracy).toBe(83);
    expect(root.status).toBe("mastered");

    const child1 = root.children[0];
    expect(child1.status).toBe("mastered");
    expect(child1.hasPractice).toBe(false);

    const child2 = root.children[1];
    expect(child2.status).toBe("weak");
    expect(child2.practiceHref).toBe("/student/practice/start?mode=knowledge&level=A&knowledge=kp-1-2");
    expect(child2.hasPractice).toBe(true);
  });

  it("marks unvisited nodes and propagates unmastered wrong questions to parents", () => {
    const statsById = new Map([
      ["kp-1-2", { answered: 10, correct: 10, hasUnmasteredWrong: true }],
    ]);

    const map = decorateKnowledgeMap(points, statsById, new Map(), false);

    expect(map.mapEnabled).toBe(false);
    const root = map.nodes[0];
    expect(root.status).toBe("weak");
    expect(root.children[0].status).toBe("unvisited");
    expect(root.children[1].status).toBe("weak");
    expect(map.stats).toEqual({ total: 3, mastered: 0, weak: 2, unvisited: 1 });
  });
});
