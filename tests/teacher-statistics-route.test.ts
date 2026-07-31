import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getTeacherLearningStatistics: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/learning-statistics-service", () => ({ getTeacherLearningStatistics: mocks.getTeacherLearningStatistics }));

import { GET } from "@/app/api/v1/teacher/statistics/route";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };

describe("teacher statistics route", () => {
  beforeEach(() => { mocks.getCurrentUser.mockReset(); mocks.getTeacherLearningStatistics.mockReset(); mocks.getTeacherLearningStatistics.mockResolvedValue({ summary: { completedSessions: 1, activeStudents: 1, answered: 1, correct: 1, accuracy: 100 }, knowledgePoints: [], students: [] }); });

  it("allows full teachers and returns non-sensitive aggregate statistics", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" });
    const response = await GET(new Request("http://localhost/api/v1/teacher/statistics?days=7"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ summary: { completedSessions: 1 } });
    expect(mocks.getTeacherLearningStatistics).toHaveBeenCalledWith(expect.any(Date));
  });

  it("rejects students and never calls the statistics service", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" });
    expect((await GET(new Request("http://localhost/api/v1/teacher/statistics"))).status).toBe(403);
    expect(mocks.getTeacherLearningStatistics).not.toHaveBeenCalled();
  });
});
