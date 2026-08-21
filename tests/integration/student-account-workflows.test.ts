import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import {
  approveRegistration,
  approveRegistrations,
  getStudentDetail,
  listRegistrationReviews,
  listStudents,
  getRegistrationStatus,
  registerStudent,
  rejectRegistration,
  resubmitRegistration,
  updateRegistrationProfile,
  updateStudentAccount,
} from "../../lib/server/student-account-service";
import {
  listTeacherStudents,
  setStudentActiveLevel,
} from "../../lib/server/teacher-student-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

const profile = {
  realName: "张三",
  nationalId: "11010519491231002X",
  school: "示例中学",
  gradeId: "",
  phone: "13800138000",
  radioPersonId: "radio-person-001",
  password: "Student2026",
  confirmPassword: "Student2026",
  truthAndPrivacyAccepted: true as const,
};

beforeAll(() => assertDatabaseName(connectionString, "practice_ci_integration"));
beforeEach(async () => {
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.reviewCard.deleteMany();
  await prisma.reviewPlan.deleteMany();
  await prisma.focusSession.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.playerLevel.deleteMany();
  await prisma.questLog.deleteMany();
  await prisma.xpLog.deleteMany();
  await prisma.aiUsageLog.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.studentActivation.deleteMany();
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentReviewRecord.deleteMany();
  await prisma.sensitiveDataReauthenticationAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.examDraft.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.questionImage.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchImage.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  // User.activeLevel has a RESTRICT FK to Level, so detach it before deleting levels.
  await prisma.user.updateMany({ data: { activeLevelId: null } });
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.radioPerson.deleteMany();
  await prisma.grade.deleteMany();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const leaves = await prisma.knowledgePoint.findMany({ where: { children: { none: {} } }, select: { id: true } });
    if (!leaves.length) throw new Error("Unable to delete knowledge point tree");
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: leaves.map((leaf) => leaf.id) } } });
  }
}

function nationalIdFor(index: number) {
  const base = "11010519491231" + String(index).padStart(3, "0");
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkDigits = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const total = [...base].reduce((sum, digit, position) => sum + Number(digit) * weights[position]!, 0);
  return base + checkDigits[total % 11];
}

async function setup() {
  const grade = await prisma.grade.create({ data: { code: "GRADE_7", name: "七年级", sortOrder: 7 } });
  const administrator = await prisma.user.create({ data: { username: "administrator", displayName: "管理员", passwordHash: "test", role: "ADMIN", mustChangePassword: false } });
  await prisma.radioPerson.createMany({ data: [{ id: "radio-person-001", username: "radio-001", name: "贡献者一", profile: "测试人物" }, { id: "radio-person-002", username: "radio-002", name: "贡献者二", profile: "测试人物" }] });
  return { grade, administrator };
}

describe("student account workflows", () => {
  it("self-registers encrypted pending accounts and returns only masked data", async () => {
    const { grade } = await setup();
    const result = await registerStudent({ ...profile, gradeId: grade.id });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: result.id } });

    expect(stored).toMatchObject({ username: "radio-001", realName: profile.realName, role: "STUDENT", studentStatus: "PENDING", registrationSource: "SELF_REGISTRATION", mustChangePassword: false, gradeId: grade.id, radioPersonId: profile.radioPersonId });
    expect(stored.nationalIdEncrypted).not.toContain(profile.nationalId);
    expect(stored.phoneEncrypted).not.toContain(profile.phone);
    expect(await getRegistrationStatus(result.id)).toMatchObject({ nationalIdMasked: expect.stringContaining("002X"), phoneMasked: "138****8000" });
    expect(await prisma.studentReviewRecord.count({ where: { studentId: result.id, action: "SUBMITTED" } })).toBe(1);
  });

  it("rejects duplicate identity and phone values without identifying the conflicting field", async () => {
    const { grade } = await setup();
    await registerStudent({ ...profile, gradeId: grade.id });
    await expect(registerStudent({ ...profile, realName: "李四", gradeId: grade.id })).rejects.toMatchObject({ message: "REGISTRATION_CONFLICT", status: 409 });
  });

  it("returns an explicit administrator detail DTO without stored secrets", async () => {
    const { grade } = await setup();
    const student = await registerStudent({ ...profile, gradeId: grade.id });
    const detail = await getStudentDetail(student.id);

    expect(detail).toMatchObject({
      id: student.id,
      username: "radio-001",
      realName: profile.realName,
      nationalIdMasked: expect.stringContaining("002X"),
      phoneMasked: "***-***-8000",
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
    expect(edited.username).toBe("radio-001");
    expect(edited.realName).toBe("张同学");
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
  it("allows only one concurrent registration to reserve a person", async () => {
    const { grade } = await setup();
    const attempts = await Promise.allSettled([
      registerStudent({ ...profile, gradeId: grade.id }),
      registerStudent({ ...profile, realName: "李四", nationalId: "110105194912310038", phone: "13900139000", gradeId: grade.id }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected");
    expect(rejected?.reason).toMatchObject({ message: expect.stringMatching(/REGISTRATION_CONFLICT|RADIO_PERSON_UNAVAILABLE/), status: 409 });
    expect(await prisma.user.count({ where: { radioPersonId: profile.radioPersonId } })).toBe(1);
  });

  it("paginates registration reviews on the server with search and status filters", async () => {
    const { grade } = await setup();
    for (let index = 1; index <= 21; index += 1) {
      const id = `radio-person-${String(index + 10).padStart(3, "0")}`;
      await prisma.radioPerson.create({ data: { id, username: `radio-page-${index}`, name: `分页学生${index}`, profile: "测试人物" } });
      await registerStudent({ ...profile, realName: `分页学生${index}`, nationalId: nationalIdFor(index), phone: `139001${String(index).padStart(5, "0")}`, gradeId: grade.id, radioPersonId: id });
    }

    const result = await listRegistrationReviews({ page: 2, pageSize: 20, status: "PENDING", search: "分页学生" });

    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.realName).toBe("分页学生21");
  });

  it("paginates administrator student accounts with masked sensitive fields", async () => {
    const { grade } = await setup();
    for (let index = 1; index <= 21; index += 1) {
      const id = `admin-list-person-${index}`;
      await prisma.radioPerson.create({ data: { id, username: `admin-list-${index}`, name: `管理分页学生${index}`, profile: "测试人物" } });
      await prisma.user.create({ data: {
        username: `admin-list-${index}`,
        displayName: `管理分页学生${index}`,
        realName: `管理分页学生${index}`,
        passwordHash: "stored-password-hash",
        role: "STUDENT",
        studentStatus: "ACTIVE",
        registrationSource: "EXCEL_IMPORT",
        nationalIdEncrypted: "stored-national-id",
        nationalIdHash: `national-${index}`,
        nationalIdLast4: String(index).padStart(4, "0"),
        school: "分页学校",
        gradeId: grade.id,
        phoneEncrypted: "stored-phone",
        phoneHash: `phone-${index}`,
        phoneLast4: String(index).padStart(4, "0"),
        validFrom: new Date("2026-07-31T00:00:00.000Z"),
        validUntil: new Date("2027-07-31T00:00:00.000Z"),
        radioPersonId: id,
        activationRequired: index === 21,
      } });
    }

    const result = await listStudents({ page: 2, pageSize: 500, status: "ACTIVE", search: "管理分页学生" });

    expect(result.pagination).toEqual({ page: 1, pageSize: 100, total: 21, totalPages: 1 });
    expect(result.items).toHaveLength(21);
    expect(result.items[20]).toMatchObject({ realName: "管理分页学生21", username: "admin-list-21", registrationSource: "EXCEL_IMPORT", studentStatus: "ACTIVE", activationRequired: true, nationalIdMasked: "**************0021", phoneMasked: "***-***-0021" });
    expect(result.items[0]).not.toHaveProperty("passwordHash");
    expect(result.items[0]).not.toHaveProperty("nationalIdEncrypted");
    expect(result.items[0]).not.toHaveProperty("phoneEncrypted");
  });

  it("defaults administrator student lists to twenty results and honors page filters", async () => {
    const { grade } = await setup();
    for (let index = 1; index <= 21; index += 1) {
      const id = `admin-page-person-${index}`;
      await prisma.radioPerson.create({ data: { id, username: `admin-page-${index}`, name: `筛选学生${index}`, profile: "测试人物" } });
      await prisma.user.create({ data: { username: `admin-page-${index}`, displayName: `筛选学生${index}`, realName: `筛选学生${index}`, passwordHash: "stored-password-hash", role: "STUDENT", studentStatus: "ACTIVE", registrationSource: "EXCEL_IMPORT", school: "筛选学校", gradeId: grade.id, radioPersonId: id } });
    }

    const result = await listStudents({ page: 2, status: "ACTIVE", search: "筛选学生" });

    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.realName).toBe("筛选学生21");
  });
  it("rolls back every approval when a batch contains a stale application", async () => {
    const { grade, administrator } = await setup();
    const first = await registerStudent({ ...profile, gradeId: grade.id });
    const second = await registerStudent({ ...profile, realName: "李四", nationalId: "110105194912310038", phone: "13900139000", gradeId: grade.id, radioPersonId: "radio-person-002" });
    await rejectRegistration(administrator.id, second.id, { reason: "资料不完整" });

    await expect(approveRegistrations(administrator.id, [first.id, second.id], "2026-07-30")).rejects.toMatchObject({ message: "STALE_ACCOUNT_STATE", status: 409 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).studentStatus).toBe("PENDING");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).studentStatus).toBe("REJECTED");
    expect(await prisma.studentReviewRecord.count({ where: { action: "APPROVED" } })).toBe(0);
  });

  it("allows exactly one concurrent review to approve an application", async () => {
    const { grade, administrator } = await setup();
    const student = await registerStudent({ ...profile, gradeId: grade.id });
    const attempts = await Promise.allSettled([
      approveRegistration(administrator.id, student.id, {}, "2026-07-30"),
      approveRegistration(administrator.id, student.id, {}, "2026-07-30"),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected");
    expect(rejected?.reason).toMatchObject({ message: "STALE_ACCOUNT_STATE", status: 409 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).studentStatus).toBe("ACTIVE");
    expect(await prisma.studentReviewRecord.count({ where: { studentId: student.id, action: "APPROVED" } })).toBe(1);
  });

  it("keeps the confirmed person bound through rejection, deactivation, expiry, and administrator updates", async () => {
    const { grade, administrator } = await setup();
    const student = await registerStudent({ ...profile, gradeId: grade.id });
    await rejectRegistration(administrator.id, student.id, { reason: "需要补充资料" });
    await updateStudentAccount(administrator.id, student.id, { enabled: false });
    await updateStudentAccount(administrator.id, student.id, { enabled: true, validFrom: "2026-07-30", validUntil: "2026-07-31", isLongTerm: false });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(stored).toMatchObject({ username: "radio-001", radioPersonId: "radio-person-001", studentStatus: "REJECTED" });
    await expect(registerStudent({ ...profile, realName: "王五", nationalId: "110105194912310046", phone: "13700137000", gradeId: grade.id })).rejects.toMatchObject({ message: "RADIO_PERSON_UNAVAILABLE", status: 409 });
    await expect(updateStudentAccount(administrator.id, student.id, { radioPersonId: "radio-person-002" })).rejects.toBeInstanceOf(Error);
    await expect(updateStudentAccount(administrator.id, student.id, { username: "radio-002" })).rejects.toBeInstanceOf(Error);
  });
});

describe("teacher student active level management", () => {
  async function setupActiveLevelData() {
    const teacher = await prisma.user.create({ data: { username: "active-level-teacher", displayName: "Active Level Teacher", passwordHash: "test", role: "TEACHER", mustChangePassword: false } });
    const levelA = await prisma.level.create({ data: { code: "A", name: "基础掌握", sortOrder: 1 } });
    const levelB = await prisma.level.create({ data: { code: "B", name: "综合提升", sortOrder: 2 } });
    const disabled = await prisma.level.create({ data: { code: "D", name: "停用类", sortOrder: 3, enabled: false } });
    const student = await prisma.user.create({ data: { username: "active-level-student", displayName: "Active Level Student", realName: "字母类学生", passwordHash: "test", role: "STUDENT", studentStatus: "ACTIVE", activeLevelId: levelA.id } });
    return { teacher, levelA, levelB, disabled, student };
  }

  it("lists teacher-visible students with their current active level", async () => {
    const { levelA, student } = await setupActiveLevelData();
    const unassigned = await prisma.user.create({ data: { username: "active-level-unassigned", displayName: "未分配学生", realName: "未分配学生", passwordHash: "test", role: "STUDENT", studentStatus: "ACTIVE" } });

    const assigned = await listTeacherStudents({ search: "字母类学生", status: "ACTIVE" });
    expect(assigned.items).toHaveLength(1);
    expect(assigned.items[0]).toMatchObject({ id: student.id, activeLevel: { id: levelA.id, code: "A", name: "基础掌握" } });

    const all = await listTeacherStudents({ search: "active-level" });
    expect(all.items.map((item) => item.id)).toEqual(expect.arrayContaining([student.id, unassigned.id]));
  });

  it("updates activeLevel and writes an audit log with before/after codes", async () => {
    const { teacher, levelA, levelB, student } = await setupActiveLevelData();

    const result = await setStudentActiveLevel(teacher.id, student.id, levelB.id);
    expect(result).toEqual({ saved: true, activeLevelId: levelB.id });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(stored.activeLevelId).toBe(levelB.id);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { targetId: student.id, action: "STUDENT_ACTIVE_LEVEL_UPDATE" } });
    expect(log.actorUserId).toBe(teacher.id);
    expect(log.targetType).toBe("User");
    expect(log.metadata).toMatchObject({ previousActiveLevelId: levelA.id, previousActiveLevelCode: "A", activeLevelId: levelB.id, activeLevelCode: "B" });
  });

  it("clears activeLevel to unassigned and writes an audit log", async () => {
    const { teacher, levelA, student } = await setupActiveLevelData();

    await setStudentActiveLevel(teacher.id, student.id, null);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).activeLevelId).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { targetId: student.id, action: "STUDENT_ACTIVE_LEVEL_UPDATE" } });
    expect(log.metadata).toMatchObject({ previousActiveLevelId: levelA.id, previousActiveLevelCode: "A", activeLevelId: null, activeLevelCode: null });
  });

  it("rejects missing students and disabled/missing levels without writing audit logs", async () => {
    const { teacher, levelA, disabled, student } = await setupActiveLevelData();

    await expect(setStudentActiveLevel(teacher.id, "missing-student", levelA.id)).rejects.toMatchObject({ status: 404, message: "学生账号不存在" });
    await expect(setStudentActiveLevel(teacher.id, student.id, disabled.id)).rejects.toMatchObject({ status: 404, message: "字母类不存在或已停用" });
    await expect(setStudentActiveLevel(teacher.id, student.id, "missing-level")).rejects.toMatchObject({ status: 404, message: "字母类不存在或已停用" });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).activeLevelId).toBe(levelA.id);
    expect(await prisma.auditLog.count({ where: { action: "STUDENT_ACTIVE_LEVEL_UPDATE" } })).toBe(0);
  });
});
