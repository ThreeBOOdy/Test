import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const startPageSource = fs.readFileSync(path.join(process.cwd(), "app/student/practice/start/page.tsx"), "utf8");

describe("student practice start sequential page", () => {
  it("shows the sequential round count and resume state on the order channel", () => {
    expect(startPageSource).toContain("级顺序训练");
    expect(startPageSource).toContain("studentLevelProgress");
    expect(startPageSource).toContain("完成 ");
    expect(startPageSource).toContain("轮");
    expect(startPageSource).toContain("上次做到第");
  });
});
