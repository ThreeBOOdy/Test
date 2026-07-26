import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import {
  approveRegistration,
  getStudentDetail,
  getRegistrationStatus,
  registerStudent,
  rejectRegistration,
  resubmitRegistration,
  updateRegistrationProfile,
} from "../../lib/server/student-account-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

const profile = {
  username: "new-student",
  displayName: "张三",
  nationalId: "11010519491231002X",
  school: "示例中学",
  gradeId: "",
  phone: "13800138000",
  password: "Student2026",
  confirmPassword: "Student2026",
  truthAndPrivacyAccepted: true as const,
};

beforeAll(() => assertDatabaseName(connectionString, "practice_ci_integration"));
beforeEach(async () => {
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentReviewRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await prisma.knowledgePoint.deleteMany();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.grade.deleteMany();
});

async function setup() {
  const grade = await prisma.grade.create({ data: { code: "GRADE_7", name: "七年级", sortOrder: 7 } });
  const administrator = await prisma.user.create({ data: { username: "administrator", displayName: "管理员", passwordHash: "test", role: "ADMIN", mustChangePassword: false } });
  return { grade, administrator };
}

describe("student account workflows", () => {
  it("self-registers encrypted pending accounts and returns only masked data", async () => {
    const { grade } = await setup();
    const result = await registerStudent({ ...profile, gradeId: grade.id });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: result.id } });

    expect(stored).toMatchObject({ role: "STUDENT", studentStatus: "PENDING", registrationSource: "SELF_REGISTRATION", mustChangePassword: false, gradeId: grade.id });
    expect(stored.nationalIdEncrypted).not.toContain(profile.nationalId);
    expect(stored.phoneEncrypted).not.toContain(profile.phone);
    expect(await getRegistrationStatus(result.id)).toMatchObject({ nationalIdMasked: expect.stringContaining("002X"), phoneMasked: "138****8000" });
    expect(await prisma.studentReviewRecord.count({ where: { studentId: result.id, action: "SUBMITTED" } })).toBe(1);
  });

  it("rejects duplicate identity and phone values without identifying the conflicting field", async () => {
    const { grade } = await setup();
    await registerStudent({ ...profile, gradeId: grade.id });
    await expect(registerStudent({ ...profile, username: "another", gradeId: grade.id })).rejects.toMatchObject({ message: "REGISTRATION_CONFLICT", status: 409 });
  });

  it("returns an explicit administrator detail DTO without stored secrets", async () => {
    const { grade } = await setup();
    const student = await registerStudent({ ...profile, gradeId: grade.id });
    const detail = await getStudentDetail(student.id);

    expect(detail).toMatchObject({
      id: student.id,
      username: profile.username,
      nationalId: profile.nationalId,
      phone: profile.phone,
      grade: { id: grade.id, code: "GRADE_7", name: "七年级" },
    });
    expect(detail).not.toHaveProperty("passwordHash");
    expect(detail).not.toHaveProperty("nationalIdEncrypted");
    expect(detail).not.toHaveProperty("nationalIdHash");
    expect(detail).not.toHaveProperty("phoneEncrypted");
    expect(detail).not.toHaveProperty("phoneHash");
  });

  it("updates rejected profiles, requires explicit resubmission, and preserves history", async () => {
    const { grade, administrator } = await setup();
    const student = await registerStudent({ ...profile, gradeId: grade.id });
    await rejectRegistration(administrator.id, student.id, { reason: "学校信息不完整" });
    const rejected = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    await updateRegistrationProfile(student.id, { displayName: "张同学", nationalId: profile.nationalId, school: "新学校", gradeId: grade.id, phone: profile.phone });
    const edited = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(edited.sessionVersion).toBe(rejected.sessionVersion);
    expect((await getRegistrationStatus(student.id)).studentStatus).toBe("REJECTED");
    await resubmitRegistration(student.id);
    const resubmitted = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(resubmitted.sessionVersion).toBe(edited.sessionVersion + 1);
    expect(await getRegistrationStatus(student.id)).toMatchObject({ studentStatus: "PENDING", rejectionReason: null });
    expect(await prisma.studentReviewRecord.count({ where: { studentId: student.id } })).toBe(4);
  });

  it("approves only pending accounts with one-year defaults and invalidates the restricted session", async () => {
    const { grade, administrator } = await setup();
    const student = await registerStudent({ ...profile, gradeId: grade.id });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    await approveRegistration(administrator.id, student.id, {}, "2026-07-26");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });

    expect(after).toMatchObject({ studentStatus: "ACTIVE", reviewedById: administrator.id, sessionVersion: before.sessionVersion + 1, isLongTerm: false });
    expect(after.validFrom?.toISOString().slice(0, 10)).toBe("2026-07-26");
    expect(after.validUntil?.toISOString().slice(0, 10)).toBe("2027-07-26");
    await expect(approveRegistration(administrator.id, student.id, {}, "2026-07-26")).rejects.toMatchObject({ message: "STALE_ACCOUNT_STATE", status: 409 });
  });
});
