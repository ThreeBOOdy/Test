import { describe, expect, it } from "vitest";
import {
  adminStudentUpdateSchema,
  approveRegistrationSchema,
  assertReviewTransition,
  buildDefaultValidity,
  gradeMutationSchema,
  publicRegistrationSchema,
  registrationProfileUpdateSchema,
  rejectRegistrationSchema,
} from "@/lib/domain/student-registration";

const validRegistration = {
  realName: " 张三 ",
  nationalId: "11010519491231002x",
  school: " 示例中学 ",
  gradeId: "grade-7",
  phone: " 138 0013 8000 ",
  radioPersonId: "radio-person-001",
  password: "student2026",
  confirmPassword: "student2026",
  truthAndPrivacyAccepted: true,
};

describe("student registration domain contracts", () => {
  it("normalizes a valid public registration and derives gender", () => {
    const result = publicRegistrationSchema.parse(validRegistration);

    expect(result).toMatchObject({
      realName: "张三",
      nationalId: "11010519491231002X",
      gender: "FEMALE",
      school: "示例中学",
      gradeId: "grade-7",
      phone: "13800138000",
      password: "student2026",
      confirmPassword: "student2026",
      truthAndPrivacyAccepted: true,
    });
  });

  it("requires a catalog identity and rejects caller-supplied usernames", () => {
    expect(publicRegistrationSchema.parse({ ...validRegistration, realName: " 李四 " }).realName).toBe("李四");
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, radioPersonId: "" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, username: "separate-account" }).success).toBe(false);
  });

  it("requires non-empty trimmed name and school", () => {
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, realName: "   " }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, school: "   " }).success).toBe(false);
  });

  it("requires gradeId for an enabled grade selected by the caller", () => {
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, gradeId: "" }).success).toBe(false);
    expect(registrationProfileUpdateSchema.safeParse({
      realName: "张三",
      nationalId: "11010519491231002X",
      school: "示例中学",
      gradeId: "   ",
      phone: "13800138000",
    }).success).toBe(false);
  });

  it("strictly validates national ID and phone", () => {
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, nationalId: "110105194912310021" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, phone: "12800138000" }).success).toBe(false);
  });

  it("requires password policy compliance and matching confirmation", () => {
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, password: "12345", confirmPassword: "12345" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, password: "1234567", confirmPassword: "1234567" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, password: "12345678", confirmPassword: "12345678" }).success).toBe(true);
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, confirmPassword: "different2026" }).success).toBe(false);
  });

  it("requires the truth and privacy acknowledgment", () => {
    expect(publicRegistrationSchema.safeParse({ ...validRegistration, truthAndPrivacyAccepted: false }).success).toBe(false);
  });

  it("forbids changing username or gender in registration profile updates", () => {
    const editableProfile = {
      displayName: "张三",
      nationalId: "110105194912310038",
      school: "示例中学",
      gradeId: "grade-7",
      phone: "13900139000",
    };

    expect(registrationProfileUpdateSchema.parse(editableProfile)).toMatchObject({ ...editableProfile, gender: "MALE" });
    expect(registrationProfileUpdateSchema.safeParse({ ...editableProfile, username: "other" }).success).toBe(false);
    expect(registrationProfileUpdateSchema.safeParse({ ...editableProfile, gender: "FEMALE" }).success).toBe(false);
  });

  it("requires a non-empty trimmed rejection reason", () => {
    expect(rejectRegistrationSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(rejectRegistrationSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(rejectRegistrationSchema.parse({ reason: "  身份信息需要更正  " })).toEqual({ reason: "身份信息需要更正" });
  });

  it("accepts approval defaults and explicit account validity settings", () => {
    expect(approveRegistrationSchema.parse({})).toEqual({});
    expect(approveRegistrationSchema.safeParse({
      isLongTerm: false,
      validFrom: "2026-07-26",
      validUntil: "2027-07-26",
    }).success).toBe(true);
    expect(approveRegistrationSchema.safeParse({
      isLongTerm: false,
      validFrom: "2027-07-26",
      validUntil: "2026-07-26",
    }).success).toBe(false);
    expect(approveRegistrationSchema.safeParse({ isLongTerm: true }).success).toBe(true);
  });

  it("allows administrator student edits but keeps username and gender immutable", () => {
    const update = {
      displayName: " 李四 ",
      nationalId: "110105194912310038",
      school: " 新学校 ",
      gradeId: "grade-8",
      phone: "13900139000",
      enabled: false,
      isLongTerm: false,
      validFrom: "2026-07-26",
      validUntil: "2027-07-26",
    };

    expect(adminStudentUpdateSchema.parse(update)).toMatchObject({
      ...update,
      displayName: "李四",
      school: "新学校",
      gender: "MALE",
    });
    expect(adminStudentUpdateSchema.safeParse({ ...update, username: "other" }).success).toBe(false);
    expect(adminStudentUpdateSchema.safeParse({ ...update, gender: "FEMALE" }).success).toBe(false);
  });

  it("validates and trims grade mutations", () => {
    expect(gradeMutationSchema.parse({ code: " G7 ", name: " 七年级 ", sortOrder: 10, enabled: true })).toEqual({
      code: "G7",
      name: "七年级",
      sortOrder: 10,
      enabled: true,
    });
    expect(gradeMutationSchema.safeParse({ code: " ", name: "七年级", sortOrder: 0, enabled: true }).success).toBe(false);
    expect(gradeMutationSchema.safeParse({ code: "G7", name: " ", sortOrder: 0, enabled: true }).success).toBe(false);
  });

  it.each([
    ["PENDING", "ACTIVE"],
    ["PENDING", "REJECTED"],
    ["REJECTED", "PENDING"],
  ] as const)("allows review transition %s to %s", (from, to) => {
    expect(() => assertReviewTransition(from, to)).not.toThrow();
  });

  it.each([
    ["ACTIVE", "PENDING"],
    ["ACTIVE", "REJECTED"],
    ["REJECTED", "ACTIVE"],
    ["PENDING", "PENDING"],
  ] as const)("rejects review transition %s to %s", (from, to) => {
    expect(() => assertReviewTransition(from, to)).toThrowError(`Invalid student review transition: ${from} -> ${to}`);
  });

  it("builds default validity from the review date using a calendar year", () => {
    expect(buildDefaultValidity("2026-07-26")).toEqual({ validFrom: "2026-07-26", validUntil: "2027-07-26" });
    expect(buildDefaultValidity("2028-02-29")).toEqual({ validFrom: "2028-02-29", validUntil: "2029-02-28" });
  });
});
