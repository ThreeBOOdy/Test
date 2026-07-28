import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

describe("teacher registration review access", () => {
  it("provides a teacher console registration review page", () => {
    const page = read("app/teacher/registrations/page.tsx");

    expect(page).toContain('role="teacher"');
    expect(page).toContain('currentPath="/teacher/registrations"');
    expect(page).toContain("RegistrationReviewManager");
  });

  it.each([
    "app/api/v1/admin/registrations/route.ts",
    "app/api/v1/admin/registrations/[id]/approve/route.ts",
    "app/api/v1/admin/registrations/[id]/reject/route.ts",
    "app/api/v1/admin/registrations/bulk-approve/route.ts",
  ])("allows teaching users through %s", (routePath) => {
    const route = read(routePath);

    expect(route).toContain("requireTeachingUser");
    expect(route).not.toContain("requireAdministrator");
  });
});
