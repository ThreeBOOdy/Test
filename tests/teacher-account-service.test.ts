import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdateMany: vi.fn(),
  userFindFirst: vi.fn(),
  radioPersonFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  revokeUserSessions: vi.fn(),
  hashPassword: vi.fn((password: string) => `hash:${password}`),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    radioPerson: { findUnique: mocks.radioPersonFindUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/server/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/server/session", () => ({ revokeUserSessions: mocks.revokeUserSessions }));

import { createTeacherAccount, deactivateTeacherAccount, resetTeacherPassword } from "@/lib/server/teacher-account-service";

const tx = {
  user: {
    findUnique: mocks.userFindUnique,
    create: mocks.userCreate,
    updateMany: mocks.userUpdateMany,
    findFirst: mocks.userFindFirst,
  },
  radioPerson: { findUnique: mocks.radioPersonFindUnique },
  auditLog: { create: mocks.auditCreate },
};

describe("teacher account service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.radioPersonFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: "teacher-1", username: "radio.teacher", displayName: "张老师", enabled: true, mustChangePassword: true, createdAt: new Date("2026-07-30T00:00:00.000Z") });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("creates an immutable teacher username with a one-time staff-grade password", async () => {
    const result = await createTeacherAccount("admin-1", { username: "radio.teacher", displayName: " 张老师 " });

    expect(result.teacher).toEqual({ id: "teacher-1", username: "radio.teacher", displayName: "张老师", enabled: true, mustChangePassword: true, createdAt: new Date("2026-07-30T00:00:00.000Z") });
    expect(result.temporaryPassword).toHaveLength(24);
    expect(mocks.hashPassword).toHaveBeenCalledWith(result.temporaryPassword);
    expect(mocks.userCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ username: "radio.teacher", displayName: "张老师", role: "TEACHER", mustChangePassword: true, passwordHash: `hash:${result.temporaryPassword}` }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "admin-1", action: "TEACHER_ACCOUNT_CREATE", targetId: "teacher-1" }) }));
  });

  it("reserves catalog usernames for future student identities", async () => {
    mocks.radioPersonFindUnique.mockResolvedValue({ id: "radio-person-001" });

    await expect(createTeacherAccount("admin-1", { username: "radio-001", displayName: "张老师" })).rejects.toMatchObject({ message: "用户名已保留为学生人物身份", status: 409 });
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
  it("rejects invalid usernames before opening a transaction", async () => {
    await expect(createTeacherAccount("admin-1", { username: "含空格", displayName: "张老师" })).rejects.toThrow("用户名只能包含");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("deactivates a teacher and revokes all sessions in the audited transaction", async () => {
    await expect(deactivateTeacherAccount("admin-1", "teacher-1")).resolves.toEqual({ disabled: true });

    expect(mocks.userUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "teacher-1", role: "TEACHER", enabled: true }, data: { enabled: false, sessionVersion: { increment: 1 } } }));
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith("teacher-1", tx);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "TEACHER_ACCOUNT_DISABLE", targetId: "teacher-1" }) }));
  });

  it("resets a teacher password, forces password change, and revokes sessions", async () => {
    const result = await resetTeacherPassword("admin-1", "teacher-1");

    expect(result.temporaryPassword).toHaveLength(24);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "teacher-1", role: "TEACHER" }, data: expect.objectContaining({ mustChangePassword: true, passwordHash: `hash:${result.temporaryPassword}`, sessionVersion: { increment: 1 } }) }));
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith("teacher-1", tx);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "TEACHER_PASSWORD_RESET", targetId: "teacher-1" }) }));
  });
});
