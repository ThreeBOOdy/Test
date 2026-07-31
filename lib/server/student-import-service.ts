import "server-only";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { findWorkbookDuplicates, validateStudentImportRow, type NormalizedStudentImportRow, type StudentImportIssue, type StudentImportRowInput } from "@/lib/domain/student-import";
import { createActivationCredential, issueStudentActivation } from "@/lib/server/student-activation-service";
import { hashPassword } from "@/lib/server/password";
import { encryptSensitiveValue, hashSensitiveValue } from "@/lib/server/student-sensitive-data";
import { getBusinessDate } from "@/lib/server/time";

const MAX_WORKSHEETS = 10;
const MAX_ROWS = 200;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const headers: Record<string, keyof StudentImportRowInput> = { 用户名:"username",姓名:"displayName",身份证号:"nationalId",学校:"school",年级:"grade",手机号:"phone",初始密码:"initialPassword",启用:"enabled",开始日期:"validFrom",结束日期:"validUntil",长期:"isLongTerm" };
type DraftPayload = Omit<NormalizedStudentImportRow, "initialPassword">;
type BatchSummary = { id:string; fileName:string; status:string; totalRows:number; validRows:number; errorRows:number; expiresAt:Date };
type StoredRow = { id:string; sheetName:string; sourceRowNumber:number; payload:unknown; initialPasswordHash:string|null; issues:unknown; valid:boolean };
type PageOptions = { page?:number; pageSize?:number };

function withoutInitialPassword<T extends { initialPassword?: unknown }>(input: T) {
  const payload = { ...input };
  Reflect.deleteProperty(payload, "initialPassword");
  return payload as Omit<T, "initialPassword">;
}

function splitDraft(row: NormalizedStudentImportRow | null, input: StudentImportRowInput) {
  return { payload: withoutInitialPassword(row ?? input) };
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function safeCell(value: ExcelJS.CellValue) {
  if (value && typeof value === "object" && "result" in value) return (value as { result?: unknown }).result ?? "";
  if (value && typeof value === "object" && "text" in value) return (value as { text?: string }).text ?? "";
  return value ?? "";
}

function normalizePageOptions(options: PageOptions = {}) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(page) || page < 1) throw new ApiError("页码必须是正整数", 400);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw new ApiError(`每页最多 ${MAX_PAGE_SIZE} 条`, 400);
  return { page, pageSize };
}


async function context() {
  const [grades, users, people] = await Promise.all([
    prisma.grade.findMany({ select: { id: true, code: true, name: true, enabled: true } }),
    prisma.user.findMany({ select: { username: true, nationalIdHash: true, phoneHash: true } }),
    prisma.radioPerson.findMany({ select: { username: true } }),
  ]);
  return {
    businessDate: getBusinessDate(),
    grades,
    existingUsernames: new Set([...users.map((user) => user.username), ...people.map((person) => person.username)]),
    existingNationalIdHashes: new Set(users.flatMap((user) => user.nationalIdHash ? [user.nationalIdHash] : [])),
    existingPhoneHashes: new Set(users.flatMap((user) => user.phoneHash ? [user.phoneHash] : [])),
    hashSensitiveValue,
  };
}

function dto(batch: BatchSummary, rows: StoredRow[], pageOptions: { page:number; pageSize:number }) {
  return {
    id: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    errorRows: batch.errorRows,
    expiresAt: batch.expiresAt.toISOString(),
    page: pageOptions.page,
    pageSize: pageOptions.pageSize,
    totalPages: Math.max(1, Math.ceil(batch.totalRows / pageOptions.pageSize)),
    rows: rows.map((row) => ({ id: row.id, sheetName: row.sheetName, sourceRowNumber: row.sourceRowNumber, payload: row.payload, issues: row.issues as StudentImportIssue[], valid: row.valid })),
  };
}

async function ownedBatch(administratorId: string, batchId: string) {
  const batch = await prisma.studentImportBatch.findFirst({ where: { id: batchId, createdById: administratorId } });
  if (!batch) throw new ApiError("导入批次不存在", 404);
  if (batch.status !== "PREVIEW" || batch.expiresAt <= new Date()) throw new ApiError("导入批次已失效", 409);
  return batch;
}

async function ownedBatchWithRows(administratorId: string, batchId: string) {
  const batch = await ownedBatch(administratorId, batchId);
  const rows = await prisma.studentImportRow.findMany({ where: { batchId }, orderBy: [{ sheetName: "asc" }, { sourceRowNumber: "asc" }] });
  return { batch, rows };
}

export async function getStudentImport(administratorId: string, batchId: string, options?: PageOptions) {
  const pageOptions = normalizePageOptions(options);
  const batch = await ownedBatch(administratorId, batchId);
  const rows = await prisma.studentImportRow.findMany({
    where: { batchId },
    orderBy: [{ sheetName: "asc" }, { sourceRowNumber: "asc" }],
    skip: (pageOptions.page - 1) * pageOptions.pageSize,
    take: pageOptions.pageSize,
  });
  return dto(batch, rows, pageOptions);
}

export async function previewStudentImport(administratorId: string, fileName: string, buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length) throw new ApiError("Excel 中没有工作表", 400);
  if (workbook.worksheets.length > MAX_WORKSHEETS) throw new ApiError(`单次导入最多 ${MAX_WORKSHEETS} 个工作表`, 400);

  const validationContext = await context();
  const parsed: { sheetName:string; sourceRowNumber:number; input:StudentImportRowInput; validation:ReturnType<typeof validateStudentImportRow> }[] = [];
  for (const sheet of workbook.worksheets) {
    if (sheet.actualRowCount > MAX_ROWS + 1 || parsed.length + Math.max(0, sheet.actualRowCount - 1) > MAX_ROWS) throw new ApiError(`单次导入最多 ${MAX_ROWS} 行学生数据`, 400);
    const map = new Map<number, keyof StudentImportRowInput>();
    sheet.getRow(1).eachCell((cell, column) => {
      const key = headers[String(safeCell(cell.value)).trim()];
      if (key) map.set(column, key);
    });
    for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
      const input = {} as StudentImportRowInput;
      for (const [column, key] of map) input[key] = safeCell(sheet.getRow(rowNumber).getCell(column).value);
      if (!Object.values(input).some((value) => String(value ?? "").trim())) continue;
      parsed.push({ sheetName: sheet.name, sourceRowNumber: rowNumber, input, validation: validateStudentImportRow(input, validationContext) });
      if (parsed.length > MAX_ROWS) throw new ApiError(`单次导入最多 ${MAX_ROWS} 行学生数据`, 400);
    }
  }
  if (!parsed.length) throw new ApiError("Excel 中没有学生数据", 400);

  const normalized = parsed.filter((item) => item.validation.row).map((item) => ({ sheetName: item.sheetName, sourceRowNumber: item.sourceRowNumber, row: item.validation.row! }));
  const duplicates = findWorkbookDuplicates(normalized);
  for (const duplicate of duplicates) for (const item of parsed) if (item.validation.row && duplicate.locations.includes(`${item.sheetName}!${item.sourceRowNumber}`)) item.validation.issues.push({ field: duplicate.field, message: `工作簿内${duplicate.field}重复` });
  for (const item of parsed) item.validation.valid = item.validation.issues.length === 0;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const batch = await prisma.$transaction(async (transaction) => {
    const created = await transaction.studentImportBatch.create({ data: { fileName, status: "PREVIEW", totalRows: parsed.length, validRows: parsed.filter((item) => item.validation.valid).length, errorRows: parsed.filter((item) => !item.validation.valid).length, sheetNames: workbook.worksheets.map((sheet) => sheet.name), createdById: administratorId, expiresAt } });
    for (const item of parsed) {
      const draft = splitDraft(item.validation.row, item.input);
      const initialPasswordHash = null;
      await transaction.studentImportRow.create({ data: { batchId: created.id, sheetName: item.sheetName, sourceRowNumber: item.sourceRowNumber, payload: asJson(draft.payload), initialPasswordHash, issues: asJson(item.validation.issues), valid: item.validation.valid } });
    }
    return created;
  });
  return getStudentImport(administratorId, batch.id);
}

export async function updateStudentImportRow(administratorId: string, batchId: string, rowId: string, input: StudentImportRowInput, options?: PageOptions) {
  const { rows } = await ownedBatchWithRows(administratorId, batchId);
  const current = rows.find((row) => row.id === rowId);
  if (!current) throw new ApiError("导入行不存在", 404);
  const validation = validateStudentImportRow(input, await context());
  const draft = splitDraft(validation.row, input);
  const initialPasswordHash = null;
  await prisma.studentImportRow.update({ where: { id: rowId }, data: { payload: asJson(draft.payload), initialPasswordHash, issues: asJson(validation.issues), valid: validation.valid } });
  return revalidateStudentImport(administratorId, batchId, options);
}

export async function revalidateStudentImport(administratorId: string, batchId: string, options?: PageOptions) {
  const { rows } = await ownedBatchWithRows(administratorId, batchId);
  const validationContext = await context();
  const validations = rows.map((row) => {
    const input = { ...(row.payload as Record<string, unknown>), initialPassword: "" } as StudentImportRowInput;
    return { row, input, validation: validateStudentImportRow(input, validationContext) };
  });
  const normalized = validations.filter((item) => item.validation.row).map((item) => ({ sheetName: item.row.sheetName, sourceRowNumber: item.row.sourceRowNumber, row: item.validation.row! }));
  const duplicates = findWorkbookDuplicates(normalized);
  for (const duplicate of duplicates) for (const item of validations) if (item.validation.row && duplicate.locations.includes(`${item.row.sheetName}!${item.row.sourceRowNumber}`)) item.validation.issues.push({ field: duplicate.field, message: `工作簿内${duplicate.field}重复` });
  for (const item of validations) item.validation.valid = item.validation.issues.length === 0;
  const validRows = validations.filter((item) => item.validation.valid).length;
  await prisma.$transaction(async (transaction) => {
    for (const item of validations) {
      const draft = item.validation.row ? splitDraft(item.validation.row, item.input) : null;
      await transaction.studentImportRow.update({ where: { id: item.row.id }, data: { issues: asJson(item.validation.issues), valid: item.validation.valid, ...(draft ? { payload: asJson(draft.payload) } : {}) } });
    }
    await transaction.studentImportBatch.update({ where: { id: batchId }, data: { totalRows: validations.length, validRows, errorRows: validations.length - validRows } });
  });
  return getStudentImport(administratorId, batchId, options);
}

export async function commitStudentImport(administratorId: string, batchId: string) {
  await revalidateStudentImport(administratorId, batchId);
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.studentImportBatch.findFirst({ where: { id: batchId, createdById: administratorId, status: "PREVIEW", expiresAt: { gt: new Date() } }, include: { rows: true } });
    if (!batch || batch.errorRows > 0 || batch.validRows !== batch.totalRows) throw new ApiError("所有行通过校验后才能导入", 409);
    const createdIds: string[] = [];
    const credentials: { username: string; initialPassword: string; activationCode: string; expiresAt: string }[] = [];
    for (const draft of batch.rows) {
      const payload = draft.payload as unknown as DraftPayload;
      if (!payload || !payload.gradeId) throw new ApiError("导入行资料不完整", 409);
      const credential = createActivationCredential();
      const student = await transaction.user.create({ data: { username: payload.username, displayName: payload.displayName, passwordHash: hashPassword(credential.initialPassword), role: "STUDENT", enabled: payload.enabled, mustChangePassword: false, activationRequired: true, studentStatus: "ACTIVE", registrationSource: "EXCEL_IMPORT", nationalIdEncrypted: encryptSensitiveValue(payload.nationalId), nationalIdHash: hashSensitiveValue(payload.nationalId), nationalIdLast4: payload.nationalId.slice(-4), gender: payload.gender, school: payload.school, gradeId: payload.gradeId, phoneEncrypted: encryptSensitiveValue(payload.phone), phoneHash: hashSensitiveValue(payload.phone), phoneLast4: payload.phone.slice(-4), submittedAt: new Date(), reviewedAt: new Date(), reviewedById: administratorId, validFrom: new Date(`${payload.validFrom}T00:00:00Z`), validUntil: new Date(`${payload.validUntil}T00:00:00Z`), isLongTerm: payload.isLongTerm, profileIncomplete: false } });
      createdIds.push(student.id);
      await issueStudentActivation(transaction, student.id, credential);
      credentials.push({ username: payload.username, initialPassword: credential.initialPassword, activationCode: credential.activationCode, expiresAt: credential.expiresAt.toISOString() });
      await transaction.studentImportRow.update({ where: { id: draft.id }, data: { initialPasswordHash: null } });
    }
    await transaction.studentImportBatch.update({ where: { id: batchId }, data: { status: "COMMITTED", committedAt: new Date() } });
    await transaction.auditLog.create({ data: { actorUserId: administratorId, action: "STUDENT_IMPORT_COMMIT", targetType: "StudentImportBatch", targetId: batchId, metadata: { count: createdIds.length } } });
    return { committed: true, count: createdIds.length, studentIds: createdIds, credentials };
  });
}
