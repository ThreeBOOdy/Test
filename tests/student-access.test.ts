import { describe, expect, expectTypeOf, it } from "vitest";
import {
  addCalendarYear,
  evaluateAccountAccess,
  type AccountAccessInput,
  type AccessCapability,
  type AccessDecision,
  type AccessErrorCode,
  type AppRole,
  type StudentStatus,
} from "@/lib/domain/student-access";

const activeStudent: AccountAccessInput = {
  role: "STUDENT",
  enabled: true,
  studentStatus: "ACTIVE",
  isLongTerm: false,
  validFrom: "2026-07-26",
  validUntil: "2027-07-26",
  mustChangePassword: false,
};

describe("student account access", () => {
  it("exports the planned access types", () => {
    const role: AppRole = "ADMIN";
    const status: StudentStatus = "PENDING";
    const capability: AccessCapability = "REGISTRATION_ONLY";
    const errorCode: AccessErrorCode = "REGISTRATION_PENDING";
    const decision = { capability, errorCode } satisfies AccessDecision;
    const allowed = { capability: "FULL_ADMIN", errorCode: null } satisfies AccessDecision;
    const denied = { capability: null, errorCode: "ACCOUNT_DISABLED" } satisfies AccessDecision;
    // @ts-expect-error Full capabilities cannot carry an error code.
    const invalidAllowed: AccessDecision = { capability: "FULL_ADMIN", errorCode: "ACCOUNT_DISABLED" };
    // @ts-expect-error Denied decisions must carry an error code.
    const invalidDenied: AccessDecision = { capability: null, errorCode: null };

    expect({ role, status, decision }).toEqual({
      role: "ADMIN",
      status: "PENDING",
      decision: { capability: "REGISTRATION_ONLY", errorCode: "REGISTRATION_PENDING" },
    });
    expectTypeOf(allowed.capability).toEqualTypeOf<"FULL_ADMIN">();
    expectTypeOf(denied.capability).toEqualTypeOf<null>();
    expect([invalidAllowed, invalidDenied]).toHaveLength(2);
  });

  it("adds a calendar year and clamps leap day", () => {
    expect(addCalendarYear("2027-02-28")).toBe("2028-02-28");
    expect(addCalendarYear("2028-02-29")).toBe("2029-02-28");
  });

  it.each([
    ["0000-01-01", "Invalid ISO date for date: 0000-01-01"],
    ["2026-7-26", "Invalid ISO date for date: 2026-7-26"],
    ["2026-02-30", "Invalid ISO date for date: 2026-02-30"],
    ["2026-07", "Invalid ISO date for date: 2026-07"],
  ])("rejects invalid calendar-year input %s", (date, message) => {
    expect(() => addCalendarYear(date)).toThrowError(message);
  });

  it("rejects calendar-year overflow", () => {
    expect(() => addCalendarYear("9999-12-31")).toThrowError("Calendar year exceeds supported range: 9999-12-31");
  });

  it("allows an active student on both inclusive validity boundaries", () => {
    expect(evaluateAccountAccess(activeStudent, "2026-07-26")).toEqual({ capability: "FULL_STUDENT", errorCode: null });
    expect(evaluateAccountAccess(activeStudent, "2027-07-26")).toEqual({ capability: "FULL_STUDENT", errorCode: null });
  });

  it("lets a long-term active student bypass validity dates", () => {
    expect(evaluateAccountAccess({ ...activeStudent, isLongTerm: true, validFrom: "2030-01-01", validUntil: "2031-01-01" }, "2026-07-26")).toEqual({ capability: "FULL_STUDENT", errorCode: null });
  });

  it("does not parse dates for a long-term active student", () => {
    expect(evaluateAccountAccess({ ...activeStudent, isLongTerm: true, validFrom: "invalid", validUntil: "also-invalid" }, "not-a-date")).toEqual({ capability: "FULL_STUDENT", errorCode: null });
  });

  it("rejects a student without an active registration status", () => {
    expect(evaluateAccountAccess({ ...activeStudent, studentStatus: null }, "2026-07-26")).toEqual({ capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" });
  });

  it("does not parse dates for a student without an active registration status", () => {
    expect(evaluateAccountAccess({ ...activeStudent, studentStatus: null, validFrom: "invalid", validUntil: "also-invalid" }, "not-a-date")).toEqual({ capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" });
  });

  it("accepts the supported ISO year boundaries", () => {
    expect(evaluateAccountAccess({ ...activeStudent, validFrom: "0001-01-01", validUntil: "0002-01-01" }, "0001-06-01")).toEqual({ capability: "FULL_STUDENT", errorCode: null });
    expect(evaluateAccountAccess({ ...activeStudent, validFrom: "9998-12-31", validUntil: "9999-12-31" }, "9999-01-01")).toEqual({ capability: "FULL_STUDENT", errorCode: null });
  });

  it.each([
    [null, "2027-07-26"],
    ["2026-07-26", null],
  ] as const)("fails closed when an active non-long-term student has validity dates %s to %s", (validFrom, validUntil) => {
    expect(evaluateAccountAccess({ ...activeStudent, validFrom, validUntil }, "2026-07-26")).toEqual({ capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" });
  });

  it.each([
    ["today", "2026-7-26", activeStudent, "Invalid ISO date for today: 2026-7-26"],
    ["today", "2026-02-30", activeStudent, "Invalid ISO date for today: 2026-02-30"],
    ["validFrom", "2026-7-26", { ...activeStudent, validFrom: "2026-7-26" }, "Invalid ISO date for validFrom: 2026-7-26"],
    ["validFrom", "2026-02-30", { ...activeStudent, validFrom: "2026-02-30" }, "Invalid ISO date for validFrom: 2026-02-30"],
    ["validUntil", "2027-7-26", { ...activeStudent, validUntil: "2027-7-26" }, "Invalid ISO date for validUntil: 2027-7-26"],
    ["validUntil", "2027-02-29", { ...activeStudent, validUntil: "2027-02-29" }, "Invalid ISO date for validUntil: 2027-02-29"],
  ] as const)("rejects invalid %s value %s", (_field, today, input, message) => {
    expect(() => evaluateAccountAccess(input, _field === "today" ? today : "2026-07-26")).toThrowError(message);
  });

  it("rejects an inverted active-student validity range", () => {
    expect(() => evaluateAccountAccess({ ...activeStudent, validFrom: "2027-07-27", validUntil: "2027-07-26" }, "2027-07-26")).toThrowError("validFrom must not be after validUntil");
  });

  it("rejects a zero-length active-student validity range", () => {
    expect(() => evaluateAccountAccess({ ...activeStudent, validFrom: "2027-07-26", validUntil: "2027-07-26" }, "2027-07-26")).toThrowError("validUntil must be after validFrom");
  });

  it.each([
    [{ role: "ADMIN", studentStatus: null }, { capability: "FULL_ADMIN", errorCode: null }],
    [{ role: "TEACHER", studentStatus: null }, { capability: "FULL_TEACHER", errorCode: null }],
    [{ role: "STUDENT", studentStatus: "PENDING" }, { capability: "REGISTRATION_ONLY", errorCode: "REGISTRATION_PENDING" }],
    [{ role: "STUDENT", studentStatus: "REJECTED" }, { capability: "REGISTRATION_ONLY", errorCode: "REGISTRATION_REJECTED" }],
  ] as const)("ignores irrelevant invalid validity fields", ({ role, studentStatus }, expected) => {
    expect(evaluateAccountAccess({ ...activeStudent, role, studentStatus, validFrom: "invalid", validUntil: "also-invalid" }, "2026-07-26")).toEqual(expected);
  });

  it.each([
    ["PENDING", "REGISTRATION_PENDING"],
    ["REJECTED", "REGISTRATION_REJECTED"],
  ] as const)("gives %s students registration-only access", (studentStatus, errorCode) => {
    expect(evaluateAccountAccess({ ...activeStudent, studentStatus, validFrom: null, validUntil: null }, "2026-07-26")).toEqual({ capability: "REGISTRATION_ONLY", errorCode });
  });

  it("blocks disabled accounts before forced-password access", () => {
    expect(evaluateAccountAccess({ ...activeStudent, enabled: false, mustChangePassword: true }, "2026-07-26")).toEqual({ capability: null, errorCode: "ACCOUNT_DISABLED" });
  });

  it.each([
    ["ADMIN", null],
    ["TEACHER", null],
    ["STUDENT", "PENDING"],
    ["STUDENT", "REJECTED"],
  ] as const)("requires password change before granting %s/%s access", (role, studentStatus) => {
    expect(evaluateAccountAccess({ ...activeStudent, role, studentStatus, mustChangePassword: true }, "2026-07-26")).toEqual({ capability: null, errorCode: "PASSWORD_CHANGE_REQUIRED" });
  });

  it.each([
    ["ADMIN", null],
    ["TEACHER", null],
    ["STUDENT", "PENDING"],
    ["STUDENT", "REJECTED"],
  ] as const)("keeps disabled access ahead of password change for %s/%s", (role, studentStatus) => {
    expect(evaluateAccountAccess({ ...activeStudent, role, studentStatus, enabled: false, mustChangePassword: true }, "2026-07-26")).toEqual({ capability: null, errorCode: "ACCOUNT_DISABLED" });
  });

  it("blocks an active student before the validity start date", () => {
    expect(evaluateAccountAccess(activeStudent, "2026-07-25")).toEqual({ capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" });
  });

  it("blocks an active student after the inclusive validity end date", () => {
    expect(evaluateAccountAccess(activeStudent, "2027-07-27")).toEqual({ capability: null, errorCode: "ACCOUNT_EXPIRED" });
  });

  it("requires a password change before granting any capability", () => {
    expect(evaluateAccountAccess({ ...activeStudent, mustChangePassword: true }, "2026-07-26")).toEqual({ capability: null, errorCode: "PASSWORD_CHANGE_REQUIRED" });
  });

  it("grants teachers full teaching access without student validity fields", () => {
    expect(evaluateAccountAccess({ role: "TEACHER", enabled: true, studentStatus: null, isLongTerm: null, validFrom: null, validUntil: null, mustChangePassword: false }, "2026-07-26")).toEqual({ capability: "FULL_TEACHER", errorCode: null });
  });

  it("grants administrators full administrative and teaching access", () => {
    expect(evaluateAccountAccess({ role: "ADMIN", enabled: true, studentStatus: null, isLongTerm: null, validFrom: null, validUntil: null, mustChangePassword: false }, "2026-07-26")).toEqual({ capability: "FULL_ADMIN", errorCode: null });
  });
});
