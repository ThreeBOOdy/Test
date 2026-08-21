import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const startPageSource = fs.readFileSync(path.join(process.cwd(), "app/student/practice/start/page.tsx"), "utf8");
const practicePageSource = fs.readFileSync(path.join(process.cwd(), "app/student/practice/page.tsx"), "utf8");

describe("student mock exam blueprint entry (issue #23)", () => {
  it("loads enabled ExamBlueprints for the student active level", () => {
    expect(startPageSource).toContain("prisma.examBlueprint.findMany");
    expect(startPageSource).toContain("enabled: true");
    expect(startPageSource).toContain("activeLevelAccess.activeLevelId");
  });

  it("renders each available blueprint as a launch card that carries its blueprint id", () => {
    expect(startPageSource).toContain("availableExams.map");
    expect(startPageSource).toContain("blueprintId: blueprint.id");
    expect(startPageSource).toContain('buildPracticeLaunchHref({ mode: "MOCK_EXAM", levelCode: activeLevelAccess.activeLevel!.code, blueprintId: blueprint.id })');
  });

  it("shows a clear empty state when no blueprint is configured", () => {
    expect(startPageSource).toContain("尚未配置模拟测试蓝图");
    expect(startPageSource).toContain("老师为当前字母类配置蓝图后，模拟考试入口会出现在这里。");
  });

  it("forwards the selected blueprint id when creating the mock session", () => {
    expect(startPageSource).toContain("blueprintId: launch.blueprintId");
    expect(practicePageSource).toContain("blueprintId: launch.blueprintId");
  });
});
