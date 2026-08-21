import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userCount: vi.fn(),
  userFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  levelFindFirst: vi.fn(),
  writeAuditLogInTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((callback: (transaction: object) => unknown) => callback({
      user: {
        count: mocks.userCount,
        findMany: mocks.userFindMany,
        findFirst: mocks.userFindFirst,
        update: mocks.userUpdate,
      },
      level: { findFirst: mocks.levelFindFirst },
    })),
  },
}));
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.writeAuditLogInTransaction }));

import { listTeacherStudents, setStudentActiveLevel } from "@/lib/server/teacher-student-service";

describe("teacher student service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.userCount.mockResolvedValue(1);
    mocks.writeAuditLogInTransaction.mockResolvedValue(undefined);
  });

  it("lists students with their active letter class", async () => {
    mocks.userFindMany.mockResolvedValue([
      {
        id: "student-1",
        username: "student-one",
        displayName: "学生一",
        realName: "学生一",
        school: "示例中学",
        grade: { name: "七年级" },
        studentStatus: "ACTIVE",
        enabled: true,
        activeLevel: { id: "level-a", code: "A", name: "基础掌握" },
      },
      {
        id: "student-2",
        username: "student-two",
        displayName: "学生二",
        realName: "学生二",
        school: null,
        grade: null,
        studentStatus: "ACTIVE",
        enabled: true,
        activeLevel: null,
      },
    ]);

    const result = await listTeacherStudents({ page: 1, pageSize: 20 });

    expect(result.items).toEqual([
      expect.objectContaining({ id: "student-1", activeLevel: { id: "level-a", code: "A", name: "基础掌握" } }),
      expect.objectContaining({ id: "student-2", activeLevel: null }),
    ]);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ activeLevel: true }) }));
  });

  it("sets a student active level and writes an audit log with before/after codes", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "student-1", activeLevelId: "level-a", activeLevel: { id: "level-a", code: "A", name: "基础掌握" } });
    mocks.levelFindFirst.mockResolvedValue({ id: "level-b", code: "B" });
    mocks.userUpdate.mockResolvedValue({ activeLevelId: "level-b" });

    const result = await setStudentActiveLevel("teacher-1", "student-1", "level-b");

    expect(result).toEqual({ saved: true, activeLevelId: "level-b" });
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "student-1" }, data: { activeLevelId: "level-b" }, select: { activeLevelId: true } });
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: "teacher-1",
        action: "STUDENT_ACTIVE_LEVEL_UPDATE",
        targetType: "User",
        targetId: "student-1",
        metadata: {
          previousActiveLevelId: "level-a",
          previousActiveLevelCode: "A",
          activeLevelId: "level-b",
          activeLevelCode: "B",
        },
      }),
    );
  });

  it("supports null to unassign a student", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "student-1", activeLevelId: "level-a", activeLevel: { id: "level-a", code: "A", name: "基础掌握" } });
    mocks.userUpdate.mockResolvedValue({ activeLevelId: null });

    const result = await setStudentActiveLevel("teacher-1", "student-1", null);

    expect(result).toEqual({ saved: true, activeLevelId: null });
    expect(mocks.levelFindFirst).not.toHaveBeenCalled();
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: expect.objectContaining({ activeLevelId: null, activeLevelCode: null }) }),
    );
  });

  it("rejects a missing student", async () => {
    mocks.userFindFirst.mockResolvedValue(null);

    await expect(setStudentActiveLevel("teacher-1", "missing", "level-a")).rejects.toMatchObject({ status: 404, message: "学生账号不存在" });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects missing or disabled levels", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "student-1", activeLevelId: null, activeLevel: null });
    mocks.levelFindFirst.mockResolvedValue(null);

    await expect(setStudentActiveLevel("teacher-1", "student-1", "disabled-level")).rejects.toMatchObject({ status: 404, message: "字母类不存在或已停用" });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
