import { describe, expect, it } from "vitest";
import { canUseNextPath, getDefaultPathForCapability, getEntryHrefForRole, getLoginRedirectForRole, getRoleForPath } from "@/lib/domain/auth-routing";

describe("role entry routing", () => {
  it("sends a mismatched session back to login instead of another console", () => {
    expect(getRoleForPath("/student")).toBe("STUDENT");
    expect(getLoginRedirectForRole("STUDENT")).toBe("/login?next=%2Fstudent&error=role-mismatch");
  });

  it("recognizes teacher entry paths", () => {
    expect(getRoleForPath("/teacher/import")).toBe("TEACHER");
    expect(getRoleForPath("/admin/students")).toBe("ADMIN");
    expect(getRoleForPath("/login")).toBeNull();
  });

  it("allows administrators to teach without granting teachers administrator access", () => {
    expect(canUseNextPath("/teacher/questions", "ADMIN")).toBe(true);
    expect(canUseNextPath("/admin/students", "ADMIN")).toBe(true);
    expect(canUseNextPath("/admin/students", "TEACHER")).toBe(false);
    expect(getLoginRedirectForRole("ADMIN")).toBe("/login?next=%2Fadmin&error=role-mismatch");
  });

  it("maps account capabilities to their default destinations", () => {
    expect(getDefaultPathForCapability("FULL_ADMIN")).toBe("/admin");
    expect(getDefaultPathForCapability("FULL_TEACHER")).toBe("/teacher");
    expect(getDefaultPathForCapability("FULL_STUDENT")).toBe("/student");
    expect(getDefaultPathForCapability("REGISTRATION_ONLY")).toBe("/registration/status");
  });

  it("opens the student growth dashboard before the practice launcher", () => {
    expect(getEntryHrefForRole("STUDENT", "STUDENT")).toBe("/student");
    expect(getEntryHrefForRole("STUDENT", null)).toBe("/login?next=%2Fstudent");
    expect(getEntryHrefForRole("STUDENT", "TEACHER")).toBe("/login?next=%2Fstudent&error=role-mismatch");
    expect(getEntryHrefForRole("TEACHER", "ADMIN")).toBe("/teacher");
  });
});
