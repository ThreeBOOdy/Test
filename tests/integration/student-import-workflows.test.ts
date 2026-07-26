import ExcelJS from "exceljs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { addCalendarYear } from "../../lib/domain/student-access";
import { commitStudentImport, previewStudentImport, updateStudentImportRow } from "../../lib/server/student-import-service";
import { getBusinessDate } from "../../lib/server/time";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

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

async function workbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  for (const [sheetName, values] of [
    ["七年级", ["excel-a", "李同学", "11010519491231002X", "示例中学", "GRADE_7", "13800138000", "Student2026", "是", "", "", "否"]],
    ["八年级", ["excel-b", "王同学", "110105194912310011", "示例中学", "八年级", "13900139000", "Student2027", "否", "2026-08-01", "2027-08-01", "是"]],
  ] as const) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(["用户名", "姓名", "身份证号", "学校", "年级", "手机号", "初始密码", "启用", "开始日期", "结束日期", "长期"]);
    sheet.addRow(values);
  }
  return workbook.xlsx.writeBuffer();
}

describe("student Excel import workflows", () => {
  it("previews multiple editable sheets and atomically creates active first-login accounts", async () => {
    const businessDate = getBusinessDate();
    await prisma.grade.createMany({ data: [
      { code: "GRADE_7", name: "七年级", sortOrder: 7 },
      { code: "GRADE_8", name: "八年级", sortOrder: 8 },
    ] });
    const administrator = await prisma.user.create({ data: { username: "administrator", displayName: "管理员", passwordHash: "test", role: "ADMIN", mustChangePassword: false } });

    const preview = await previewStudentImport(administrator.id, "students.xlsx", await workbookBuffer());
    expect(preview).toMatchObject({ totalRows: 2, validRows: 2, errorRows: 0 });
    expect(JSON.stringify(preview)).not.toContain("Student2026");
    expect(await prisma.studentImportRow.count({ where: { batchId: preview.id, initialPasswordEncrypted: { not: null } } })).toBe(2);

    const firstRow = preview.rows[0];
    const edited = await updateStudentImportRow(administrator.id, preview.id, firstRow.id, { ...(firstRow.payload as Record<string, unknown>), username: "excel-a-edited", initialPassword: "" } as never);
    expect(edited.rows[0].payload).toMatchObject({ username: "excel-a-edited", gender: "FEMALE" });

    const result = await commitStudentImport(administrator.id, preview.id);
    expect(result).toMatchObject({ committed: true, count: 2 });
    const students = await prisma.user.findMany({ where: { registrationSource: "EXCEL_IMPORT" }, orderBy: { username: "asc" } });
    expect(students).toHaveLength(2);
    expect(students[0]).toMatchObject({ username: "excel-a-edited", studentStatus: "ACTIVE", mustChangePassword: true, enabled: true, isLongTerm: false });
    expect(students[1]).toMatchObject({ username: "excel-b", studentStatus: "ACTIVE", mustChangePassword: true, enabled: false, isLongTerm: true });
    expect(students[0].validFrom?.toISOString().slice(0, 10)).toBe(businessDate);
    expect(students[0].validUntil?.toISOString().slice(0, 10)).toBe(addCalendarYear(businessDate));
    expect(await prisma.studentImportRow.count({ where: { batchId: preview.id, initialPasswordEncrypted: { not: null } } })).toBe(0);
  });

  it("refuses commit while any row is invalid and creates no partial users", async () => {
    await prisma.grade.create({ data: { code: "GRADE_7", name: "七年级" } });
    const administrator = await prisma.user.create({ data: { username: "administrator", displayName: "管理员", passwordHash: "test", role: "ADMIN", mustChangePassword: false } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("学生");
    sheet.addRow(["用户名", "姓名", "身份证号", "学校", "年级", "手机号", "初始密码"]);
    sheet.addRow(["broken", "错误学生", "invalid", "示例中学", "GRADE_7", "13800138000", "Student2026"]);
    const preview = await previewStudentImport(administrator.id, "broken.xlsx", await workbook.xlsx.writeBuffer());

    await expect(commitStudentImport(administrator.id, preview.id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.count({ where: { registrationSource: "EXCEL_IMPORT" } })).toBe(0);
  });

  it("revalidates duplicates across edited workbook rows before commit", async () => {
    await prisma.grade.createMany({ data: [
      { code: "GRADE_7", name: "七年级", sortOrder: 7 },
      { code: "GRADE_8", name: "八年级", sortOrder: 8 },
    ] });
    const administrator = await prisma.user.create({ data: { username: "administrator", displayName: "管理员", passwordHash: "test", role: "ADMIN", mustChangePassword: false } });
    const preview = await previewStudentImport(administrator.id, "students.xlsx", await workbookBuffer());

    const edited = await updateStudentImportRow(administrator.id, preview.id, preview.rows[0].id, {
      ...(preview.rows[0].payload as Record<string, unknown>),
      username: "excel-b",
      initialPassword: "",
    } as never);

    expect(edited).toMatchObject({ validRows: 0, errorRows: 2 });
    expect(edited.rows.every((row) => row.issues.some((issue) => issue.message.includes("工作簿内username重复")))).toBe(true);
    await expect(commitStudentImport(administrator.id, preview.id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.count({ where: { registrationSource: "EXCEL_IMPORT" } })).toBe(0);
  });
});
