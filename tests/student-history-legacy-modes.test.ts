import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historySource = fs.readFileSync(path.join(process.cwd(), "app/student/history/page.tsx"), "utf8");

describe("student history legacy mode records", () => {
  it("still renders comprehensive and knowledge-point session titles", () => {
    expect(historySource).toContain('mode === "KNOWLEDGE_POINT"');
    expect(historySource).toContain("知识点专项");
    expect(historySource).toContain("级综合练习");
  });

  it("lists every practice session regardless of mode", () => {
    expect(historySource).toContain("prisma.practiceSession.findMany");
    expect(historySource).toContain("{ userId: user.id }");
  });
});
