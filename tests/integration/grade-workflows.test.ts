import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

beforeAll(() => assertDatabaseName(connectionString, "practice_ci_integration"));

describe("grade workflows", () => {
  it("enforces unique codes and names", async () => {
    const suffix = randomUUID();
    const code = `GRADE_UNIQUE_${suffix}`;
    const name = `唯一年级-${suffix}`;
    const grade = await prisma.grade.create({ data: { code, name, sortOrder: 7 } });
    try {
      await expect(prisma.grade.create({ data: { code, name: `另一个年级-${suffix}` } })).rejects.toMatchObject({ code: "P2002" });
      await expect(prisma.grade.create({ data: { code: `GRADE_OTHER_${suffix}`, name } })).rejects.toMatchObject({ code: "P2002" });
    } finally {
      await prisma.grade.delete({ where: { id: grade.id } });
    }
  });

  it("allows only enabled grades to be selected for registration queries", async () => {
    const suffix = randomUUID();
    const marker = `GRADE_REGISTRATION_${suffix}`;
    await prisma.grade.createMany({ data: [
      { code: `${marker}_7`, name: `注册七年级-${suffix}`, sortOrder: 20, enabled: true },
      { code: `${marker}_8`, name: `注册八年级-${suffix}`, sortOrder: 10, enabled: false },
      { code: `${marker}_9`, name: `注册九年级-${suffix}`, sortOrder: 5, enabled: true },
    ] });
    try {
      await expect(prisma.grade.findMany({ where: { enabled: true, code: { startsWith: marker } }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }], select: { code: true } })).resolves.toEqual([
        { code: `${marker}_9` }, { code: `${marker}_7` },
      ]);
    } finally {
      await prisma.grade.deleteMany({ where: { code: { startsWith: marker } } });
    }
  });

  it("prevents deleting a grade referenced by a student", async () => {
    const suffix = randomUUID();
    const grade = await prisma.grade.create({ data: { code: `GRADE_REFERENCED_${suffix}`, name: `被引用年级-${suffix}` } });
    const student = await prisma.user.create({ data: { username: `grade-student-${suffix}`, displayName: "Student", passwordHash: "test", role: "STUDENT", gradeId: grade.id } });
    try {
      await expect(prisma.grade.delete({ where: { id: grade.id } })).rejects.toMatchObject({ code: "P2003" });
    } finally {
      await prisma.user.delete({ where: { id: student.id } });
      await prisma.grade.delete({ where: { id: grade.id } });
    }
  });
});
