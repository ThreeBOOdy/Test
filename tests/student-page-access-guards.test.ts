import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const studentPages = [
  "app/student/page.tsx",
  "app/student/history/page.tsx",
  "app/student/wrong/page.tsx",
  "app/student/practice/page.tsx",
  "app/student/practice/start/page.tsx",
];

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("student server-page access guards", () => {
  it("requires FULL_STUDENT before the student layout renders children", () => {
    const source = read("app/student/layout.tsx");
    const capabilityGuard = source.indexOf('user.capability !== "FULL_STUDENT"');

    expect(capabilityGuard).toBeGreaterThan(-1);
    expect(capabilityGuard).toBeLessThan(source.indexOf("return children"));
  });

  it.each(studentPages)("guards %s before learning-data access", (file) => {
    const source = read(file);
    const currentUserLookup = source.indexOf("await getCurrentUser()");
    const capabilityGuard = source.indexOf('user.capability !== "FULL_STUDENT"');
    const protectedOperations = [
      source.indexOf("prisma."),
      source.indexOf("createPracticeSession("),
      source.indexOf("<AppShell"),
    ].filter((position) => position >= 0);

    expect(currentUserLookup).toBeGreaterThan(-1);
    expect(capabilityGuard).toBeGreaterThan(currentUserLookup);
    expect(protectedOperations.length).toBeGreaterThan(0);
    for (const protectedOperation of protectedOperations) {
      expect(capabilityGuard, `${file} must guard before protected work`).toBeLessThan(protectedOperation);
    }
  });
});
