import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const studentHomeSource = fs.readFileSync(path.join(process.cwd(), "app/student/page.tsx"), "utf8");
const launcherSource = fs.readFileSync(path.join(process.cwd(), "app/student/practice/start/page.tsx"), "utf8");

describe("student home practice entry points", () => {
  it("converges the student home to the five practice entries", () => {
    expect(studentHomeSource).toContain('href="/student/practice/start"');
    expect(studentHomeSource).toContain("/student/practice/start?mode=order");
    expect(studentHomeSource).toContain("/student/practice/start?mode=random");
    expect(studentHomeSource).toContain("/student/practice/start?mode=exam");
    expect(studentHomeSource).toContain('href="/student/wrong"');
    expect(studentHomeSource).toContain('href="/student/favorites"');
  });

  it("hides comprehensive and knowledge-point entries from the student home", () => {
    expect(studentHomeSource).not.toContain("/student/practice/start?mode=level");
    expect(studentHomeSource).not.toContain("/student/practice/start?mode=knowledge");
    expect(studentHomeSource).not.toContain("级综合训练");
  });

  it("keeps the practice launcher focused on order/random/wrong/mock/favorites only", () => {
    expect(launcherSource).toContain('buildPracticeLaunchHref({ mode: "QUESTION_ORDER"');
    expect(launcherSource).toContain('buildPracticeLaunchHref({ mode: "RANDOM_ALL"');
    expect(launcherSource).toContain('buildPracticeLaunchHref({ mode: "WRONG_QUESTION"');
    expect(launcherSource).toContain('buildPracticeLaunchHref({ mode: "MOCK_EXAM"');
    expect(launcherSource).toContain('href="/student/favorites"');
    expect(launcherSource).not.toContain('buildPracticeLaunchHref({ mode: "LEVEL_COMPREHENSIVE"');
    expect(launcherSource).not.toContain('buildPracticeLaunchHref({ mode: "KNOWLEDGE_POINT"');
    expect(launcherSource).not.toContain("级综合训练");
  });
});
