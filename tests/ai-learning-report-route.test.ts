import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  generateStudentWeeklyReport: vi.fn(),
  generateTeacherClassReport: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/ai/report", () => ({
  generateStudentWeeklyReport: mocks.generateStudentWeeklyReport,
  generateTeacherClassReport: mocks.generateTeacherClassReport,
}));

import { GET as studentGET } from "@/app/api/v1/student/reports/weekly/route";
import { GET as teacherGET } from "@/app/api/v1/teacher/reports/ai/route";

const baseUser = { id: "user-1", username: "user", displayName: "User", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };

const studentReport = { generatedAt: "2026-08-17T00:00:00.000Z", content: { summary: "本周表现稳定" } };
const teacherReport = { generatedAt: "2026-08-17T00:00:00.000Z", content: { overview: "班级整体正确率中等" } };

describe("AI learning report routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(teacher);
    mocks.generateStudentWeeklyReport.mockResolvedValue(studentReport);
    mocks.generateTeacherClassReport.mockResolvedValue(teacherReport);
  });

  it("GET student weekly report returns a report for active students", async () => {
    mocks.getCurrentUser.mockResolvedValue(student);
    const response = await studentGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(studentReport);
    expect(mocks.generateStudentWeeklyReport).toHaveBeenCalledWith("user-1");
  });

  it("GET student weekly report rejects teachers", async () => {
    const response = await studentGET();
    expect(response.status).toBe(403);
    expect(mocks.generateStudentWeeklyReport).not.toHaveBeenCalled();
  });

  it("GET teacher class report returns a report for teachers", async () => {
    const response = await teacherGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(teacherReport);
    expect(mocks.generateTeacherClassReport).toHaveBeenCalledWith("user-1");
  });

  it("GET teacher class report rejects students", async () => {
    mocks.getCurrentUser.mockResolvedValue(student);
    const response = await teacherGET();
    expect(response.status).toBe(403);
    expect(mocks.generateTeacherClassReport).not.toHaveBeenCalled();
  });
});
