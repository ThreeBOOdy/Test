import { describe, expect, it } from "vitest";
import { canUseLoginNextPath } from "@/lib/domain/auth-routing";

describe("administrator login destination", () => {
  it("does not let a teacher login link override the administrator console", () => {
    expect(canUseLoginNextPath("/teacher", "ADMIN")).toBe(false);
    expect(canUseLoginNextPath("/admin/students", "ADMIN")).toBe(true);
    expect(canUseLoginNextPath("/teacher/reports", "TEACHER")).toBe(true);
  });
});
