import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  activationFindUnique: vi.fn(),
  activationCreate: vi.fn(),
  activationUpdate: vi.fn(),
  activationUpdateMany: vi.fn(),
  activationDeleteMany: vi.fn(),
  personFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  revokeUserSessions: vi.fn(),
  hashPassword: vi.fn((value: string) => `hash:${value}`),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $transaction: mocks.transaction, studentActivation: { deleteMany: mocks.activationDeleteMany } } }));
vi.mock("@/lib/server/password", () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }));
vi.mock("@/lib/server/session", () => ({ revokeUserSessions: mocks.revokeUserSessions }));

import { activateImportedStudent, createActivationCredential, purgeExpiredStudentActivations, regeneratePendingStudentActivation } from "@/lib/server/student-activation-service";

const now = new Date("2026-07-31T00:00:00.000Z");
const person = { id: "person-1", username: "radio-001", name: "人物一", profile: "测试人物", resourceStatus: "AVAILABLE" };
const student = {
  id: "student-1",
  role: "STUDENT",
  passwordHash: "initial-hash",
  studentActivation: { id: "activation-1", version: 3, activationCodeHash: "code-hash", expiresAt: new Date("2026-08-30T00:00:00.000Z"), usedAt: null },
};

function setupTransaction() {
  const tx = {
    user: { findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    studentActivation: { findUnique: mocks.activationFindUnique, create: mocks.activationCreate, update: mocks.activationUpdate, updateMany: mocks.activationUpdateMany },
    radioPerson: { findFirst: mocks.personFindFirst },
    auditLog: { create: mocks.auditCreate },
  };
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
  mocks.userFindFirst.mockResolvedValue(student);
  mocks.personFindFirst.mockResolvedValue(person);
  mocks.activationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.activationDeleteMany.mockResolvedValue({ count: 2 });
  mocks.userUpdate.mockResolvedValue({ ...student, username: person.username, role: "STUDENT", activationRequired: false, mustChangePassword: false });
  mocks.verifyPassword.mockImplementation((value: string, encoded: string) => (value === "InitialPass123!" && encoded === "initial-hash") || (value === "activation-code" && encoded === "code-hash"));
}

describe("student one-time activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it("generates high-entropy credentials with a thirty-day expiry", () => {
    const credential = createActivationCredential(now);
    expect(credential.initialPassword).not.toBe(credential.activationCode);
    expect(credential.initialPassword).toHaveLength(26);
    expect(credential.expiresAt).toEqual(new Date("2026-08-30T00:00:00.000Z"));
  });

  it("requires both secrets and atomically binds the person while consuming the code", async () => {
    mocks.userFindFirst.mockResolvedValueOnce(student).mockResolvedValueOnce(null);

    const result = await activateImportedStudent("student-1", { initialPassword: "InitialPass123!", activationCode: "activation-code", newPassword: "NewPass123!", radioPersonId: "person-1" });

    expect(result).toMatchObject({ username: "radio-001", activationRequired: false, mustChangePassword: false });
    expect(mocks.activationUpdateMany).toHaveBeenCalledWith({ where: { id: "activation-1", version: 3, usedAt: null, expiresAt: { gt: expect.any(Date) } }, data: { usedAt: expect.any(Date) } });
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ radioPersonId: "person-1", passwordHash: "hash:NewPass123!", activationRequired: false }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "STUDENT_ACTIVATION_COMPLETE", targetId: "student-1" }) }));
  });

  it("allows a retry after incorrect credentials without consuming the activation", async () => {
    mocks.verifyPassword.mockReturnValue(false);

    await expect(activateImportedStudent("student-1", { initialPassword: "wrong-password", activationCode: "wrong-code", newPassword: "NewPass123!", radioPersonId: "person-1" })).rejects.toMatchObject({ status: 400 });
    expect(mocks.activationUpdateMany).not.toHaveBeenCalled();

    mocks.verifyPassword.mockImplementation((value: string, encoded: string) => (value === "InitialPass123!" && encoded === "initial-hash") || (value === "activation-code" && encoded === "code-hash"));
    mocks.userFindFirst.mockResolvedValueOnce(student).mockResolvedValueOnce(null);
    await expect(activateImportedStudent("student-1", { initialPassword: "InitialPass123!", activationCode: "activation-code", newPassword: "NewPass123!", radioPersonId: "person-1" })).resolves.toMatchObject({ activationRequired: false });
  });
  it("rejects an expired activation before changing password or identity", async () => {
    mocks.userFindFirst.mockResolvedValue({ ...student, studentActivation: { ...student.studentActivation, expiresAt: new Date("2026-07-30T00:00:00.000Z") } });

    await expect(activateImportedStudent("student-1", { initialPassword: "InitialPass123!", activationCode: "activation-code", newPassword: "NewPass123!", radioPersonId: "person-1" })).rejects.toMatchObject({ status: 410 });
    expect(mocks.activationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects a concurrent second consumer when the versioned update loses the race", async () => {
    mocks.activationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(activateImportedStudent("student-1", { initialPassword: "InitialPass123!", activationCode: "activation-code", newPassword: "NewPass123!", radioPersonId: "person-1" })).rejects.toMatchObject({ status: 409 });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects a competing credential regeneration that loses the versioned update", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "student-1" });
    mocks.activationFindUnique.mockResolvedValue({ id: "activation-1", version: 3 });
    mocks.activationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(regeneratePendingStudentActivation("admin-1", "student-1")).rejects.toMatchObject({ status: 409 });
  });

  it("purges activation hashes after the configured retention window", async () => {
    await expect(purgeExpiredStudentActivations(7, now)).resolves.toEqual({ deleted: 2 });
    expect(mocks.activationDeleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: new Date("2026-07-24T00:00:00.000Z") } } });
  });
  it("regenerates pending credentials and records no plaintext in the audit metadata", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "student-1" });
    mocks.activationFindUnique.mockResolvedValue({ id: "activation-1", version: 3 });
    mocks.activationUpdate.mockResolvedValue({});
    const result = await regeneratePendingStudentActivation("admin-1", "student-1");

    expect(result.initialPassword).toBeTruthy();
    expect(result.activationCode).toBeTruthy();
    expect(mocks.activationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "activation-1", version: 3 }, data: expect.objectContaining({ version: { increment: 1 }, usedAt: null }) }));
    const audit = mocks.auditCreate.mock.calls.at(-1)?.[0].data;
    expect(JSON.stringify(audit)).not.toContain(result.initialPassword);
    expect(JSON.stringify(audit)).not.toContain(result.activationCode);
  });
});
