import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("administrator registration workflow", () => {
  it("links registration review to student account management", () => {
    const page = fs.readFileSync(path.resolve("app/admin/registrations/page.tsx"), "utf8");

    expect(page).toContain('href="/admin/students"');
    expect(page).toContain("学生账号管理");
  });
});
