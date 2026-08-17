import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listGradeGamificationSettings: vi.fn(),
  setGradeGamificationEnabled: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/gamification-settings-service", () => ({
  listGradeGamificationSettings: mocks.listGradeGamificationSettings,
  setGradeGamificationEnabled: mocks.setGradeGamificationEnabled,
}));

import { GET as gradesGET } from "@/app/api/v1/teacher/grades/route";
import { PATCH as gamificationPATCH } from "@/app/api/v1/teacher/grades/[id]/gamification/route";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };

const grade = {
  id: "grade-1",
  code: "JUNIOR_1",
  name: "一年级",
  studentCount: 3,
  gamificationEnabled: true,
};

describe("teacher grade gamification routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(teacher);
    mocks.listGradeGamificationSettings.mockResolvedValue([grade]);
    mocks.setGradeGamificationEnabled.mockResolvedValue({ ...grade, gamificationEnabled: false });
  });

  it("GET grades returns class gamification settings for teachers", async () => {
    const response = await gradesGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ grades: [grade] });
    expect(mocks.listGradeGamificationSettings).toHaveBeenCalledOnce();
  });

  it("GET grades rejects students", async () => {
    mocks.getCurrentUser.mockResolvedValue(student);
    const response = await gradesGET();
    expect(response.status).toBe(403);
    expect(mocks.listGradeGamificationSettings).not.toHaveBeenCalled();
  });

  it("PATCH gamification updates a grade for teachers", async () => {
    const request = new Request("http://localhost/api/v1/teacher/grades/grade-1/gamification", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ enabled: false }),
    });
    const response = await gamificationPATCH(request, { params: Promise.resolve({ id: "grade-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "grade-1", gamificationEnabled: false });
    expect(mocks.setGradeGamificationEnabled).toHaveBeenCalledWith("user-1", "grade-1", false);
  });

  it("PATCH gamification rejects students", async () => {
    mocks.getCurrentUser.mockResolvedValue(student);
    const request = new Request("http://localhost/api/v1/teacher/grades/grade-1/gamification", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ enabled: false }),
    });
    const response = await gamificationPATCH(request, { params: Promise.resolve({ id: "grade-1" }) });
    expect(response.status).toBe(403);
    expect(mocks.setGradeGamificationEnabled).not.toHaveBeenCalled();
  });
});
