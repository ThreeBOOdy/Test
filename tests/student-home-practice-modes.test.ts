import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const studentHomeSource = fs.readFileSync(path.join(process.cwd(), "app/student/page.tsx"), "utf8");

describe("student home practice entry points", () => {
  it("keeps practice modes in the unified launcher instead of duplicating them on the home page", () => {
    expect(studentHomeSource).toContain('href="/student/practice/start"');
    expect(studentHomeSource).not.toContain("基础练习模式");
    expect(studentHomeSource).not.toContain("CORE PRACTICE MODES");
    expect(studentHomeSource).not.toContain("/student/practice/start?mode=order");
    expect(studentHomeSource).not.toContain("/student/practice/start?mode=random");
    expect(studentHomeSource).not.toContain("/student/practice/start?mode=exam");
  });
});
