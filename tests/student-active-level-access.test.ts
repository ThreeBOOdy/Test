import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("student activeLevel filtering and unassigned blocking", () => {
  it("shows the unassigned message and scopes home practice entries to the student activeLevel", () => {
    const source = read("app/student/page.tsx");
    expect(source).toContain("getStudentActiveLevelAccess");
    expect(source).toContain("未分配题库，请联系老师");
    expect(source).toContain("activeLevelQuestionTotal");
    expect(source).toContain("item.levelId === activeLevelId");
  });

  it("scopes the practice launcher to activeLevel and blocks mode launches when unassigned", () => {
    const source = read("app/student/practice/start/page.tsx");
    expect(source).toContain("getStudentActiveLevelAccess");
    expect(source).toContain("未分配题库，请联系老师");
    expect(source).toContain("activeLevelQuestionTotal");
    expect(source).toContain("if (params.mode && !hasActiveLevel) redirect(\"/student/practice/start\")");
  });

  it("filters wrong questions by activeLevel and guards the wrong page for unassigned students", () => {
    const source = read("app/student/wrong/page.tsx");
    expect(source).toContain("getStudentActiveLevelAccess");
    expect(source).toContain("未分配题库，请联系老师");
    expect(source).toContain("levelId: activeLevelId");
    expect(source).toContain("studentLevelQuestionState");
  });

  it("filters favorite questions by activeLevel and guards the favorites page for unassigned students", () => {
    const source = read("app/student/favorites/page.tsx");
    expect(source).toContain("getStudentActiveLevelAccess");
    expect(source).toContain("未分配题库，请联系老师");
    expect(source).toContain("levelId: activeLevelId");
    expect(source).toContain("favorite: true");
    expect(source).toContain("studentLevelQuestionState");
  });

  it("enforces activeLevel in the practice creation service", () => {
    const helper = read("lib/server/student-level-access.ts");
    const service = read("lib/server/practice-service.ts");
    expect(helper).toContain("未分配题库，请联系老师");
    expect(service).toContain("只能练习当前分配的字母类");
    expect(service).toContain("studentLevelQuestionState.findMany");
    expect(service).toContain("levelId: activeLevelId");
  });

  it("renders the StudentLevelQuestionState mastery overview on the student home page", () => {
    const source = read("app/student/page.tsx");
    expect(source).toContain("StudentMasteryOverview");
    expect(source).toContain("getStudentMasteryOverview");
    expect(source).toContain("masteryOverview");
  });
});
