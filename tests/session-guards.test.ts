import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/server/session", () => ({ getCurrentUser }));

import {
  requireActiveStudent,
  requireAdministrator,
  requireRegistrationStudent,
  requireTeachingUser,
} from "@/lib/server/api";

const baseUser = {
  id: "user-1",
  username: "user",
  displayName: "User",
  mustChangePassword: false,
  sessionVersion: 0,
  studentStatus: null,
  isLongTerm: false,
  validFrom: null,
  validUntil: null,
};

describe("session capability guards", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("requires an authenticated usable session", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(requireAdministrator()).rejects.toMatchObject({ status: 401 });
    await expect(requireTeachingUser()).rejects.toMatchObject({ status: 401 });
    await expect(requireActiveStudent()).rejects.toMatchObject({ status: 401 });
    await expect(requireRegistrationStudent()).rejects.toMatchObject({ status: 401 });
  });

  it("allows administrators to administer and teach", async () => {
    const administrator = { ...baseUser, role: "ADMIN", capability: "FULL_ADMIN" };
    getCurrentUser.mockResolvedValue(administrator);

    await expect(requireAdministrator()).resolves.toBe(administrator);
    await expect(requireTeachingUser()).resolves.toBe(administrator);
    await expect(requireActiveStudent()).rejects.toMatchObject({ status: 403 });
  });

  it("allows teachers only through the teaching guard", async () => {
    const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };
    getCurrentUser.mockResolvedValue(teacher);

    await expect(requireTeachingUser()).resolves.toBe(teacher);
    await expect(requireAdministrator()).rejects.toMatchObject({ status: 403 });
    await expect(requireActiveStudent()).rejects.toMatchObject({ status: 403 });
  });

  it("separates full students from registration-only students", async () => {
    const activeStudent = { ...baseUser, role: "STUDENT", studentStatus: "ACTIVE", capability: "FULL_STUDENT" };
    getCurrentUser.mockResolvedValue(activeStudent);
    await expect(requireActiveStudent()).resolves.toBe(activeStudent);
    await expect(requireRegistrationStudent()).rejects.toMatchObject({ status: 403 });

    const registrationStudent = { ...baseUser, role: "STUDENT", studentStatus: "PENDING", capability: "REGISTRATION_ONLY" };
    getCurrentUser.mockResolvedValue(registrationStudent);
    await expect(requireRegistrationStudent()).resolves.toBe(registrationStudent);
    await expect(requireActiveStudent()).rejects.toMatchObject({ status: 403 });
  });
});
