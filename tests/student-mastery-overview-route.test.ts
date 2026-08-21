import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  getStudentMasteryOverview: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireActiveStudent: mocks.requireActiveStudent };
});
vi.mock("@/lib/server/student-mastery-overview-service", () => ({
  getStudentMasteryOverview: mocks.getStudentMasteryOverview,
}));

import { GET } from "@/app/api/v1/student/mastery-overview/route";
import { ApiError } from "@/lib/domain/api-error";

const student = { id: "student-1", username: "student", displayName: "Student", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: "ACTIVE", isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };

describe("student mastery overview API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.getStudentMasteryOverview.mockResolvedValue({
      levelId: "level-a",
      levelCode: "A",
      levelName: "A级",
      total: 10,
      notStarted: 7,
      learning: 1,
      due: 1,
      mastered: 1,
    });
  });

  it("returns the active-level mastery overview for the current student", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      levelId: "level-a",
      levelCode: "A",
      levelName: "A级",
      total: 10,
      notStarted: 7,
      learning: 1,
      due: 1,
      mastered: 1,
    });
    expect(mocks.getStudentMasteryOverview).toHaveBeenCalledWith("student-1");
  });

  it("rejects non-students with a permission error", async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError("权限不足", 403));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "权限不足" });
    expect(mocks.getStudentMasteryOverview).not.toHaveBeenCalled();
  });
});
