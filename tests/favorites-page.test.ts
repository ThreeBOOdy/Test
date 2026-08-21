import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("student favorite list page", () => {
  it("adds a favorite entry to the student navigation", () => {
    const navigation = read("components/navigation-items.ts");
    expect(navigation).toContain('{ href: "/student/favorites", label: "我的收藏", icon: Star }');
  });

  it("lists only favorite questions under the current activeLevel", () => {
    const page = read("app/student/favorites/page.tsx");
    expect(page).toContain("getStudentActiveLevelAccess");
    expect(page).toContain("levelId: activeLevelId");
    expect(page).toContain("favorite: true");
    expect(page).toContain("未分配题库，请联系老师");
  });

  it("starts a FAVORITE practice session from the favorite list", () => {
    const page = read("app/student/favorites/page.tsx");
    expect(page).toContain('href="/student/practice/start?mode=favorite"');
    expect(page).toContain("练习收藏题");

    const launcher = read("app/student/practice/start/page.tsx");
    expect(launcher).toContain('launch.mode === "FAVORITE" ? { mode: "favorite" }');
  });

  it("shows an empty state when the student has no favorites", () => {
    const page = read("app/student/favorites/page.tsx");
    expect(page).toContain("暂无收藏题目");
  });
});
