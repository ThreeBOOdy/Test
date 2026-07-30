import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

describe("administrator registration review access", () => {
  it("redirects the legacy teacher registration path to the teacher console", () => {
    const page = read("app/teacher/registrations/page.tsx");

    expect(page).toContain('redirect("/teacher")');
    expect(page).not.toContain("RegistrationReviewManager");
  });

  it.each([
    "app/api/v1/admin/registrations/route.ts",
    "app/api/v1/admin/registrations/[id]/approve/route.ts",
    "app/api/v1/admin/registrations/[id]/reject/route.ts",
    "app/api/v1/admin/registrations/bulk-approve/route.ts",
  ])("allows only administrators through %s", (routePath) => {
    const route = read(routePath);

    expect(route).toContain("requireAdministrator");
    expect(route).not.toContain("requireTeachingUser");
  });
});
