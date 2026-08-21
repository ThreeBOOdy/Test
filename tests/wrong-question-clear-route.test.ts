import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  requireTeacher: vi.fn(),
  assertSameOrigin: vi.fn(),
  clearOwnWrongQuestions: vi.fn(),
  clearStudentWrongQuestions: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireActiveStudent: mocks.requireActiveStudent, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/wrong-question-clear-service", () => ({
  clearOwnWrongQuestions: mocks.clearOwnWrongQuestions,
  clearStudentWrongQuestions: mocks.clearStudentWrongQuestions,
}));

import { POST as studentClearPOST } from "@/app/api/v1/student/wrong/clear/route";
import { POST as teacherClearPOST } from "@/app/api/v1/teacher/students/[id]/wrong/clear/route";
import { ApiError } from "@/lib/domain/api-error";

const student = { id: "student-1", role: "STUDENT", capability: "FULL_STUDENT" };
const teacher = { id: "teacher-1", role: "TEACHER", capability: "FULL_TEACHER" };

const clearResult = { cleared: 3, levelId: "level-a", levelCode: "A" };

function postRequest(url: string) {
  return new Request(url, {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
  });
}

describe("wrong question clear API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.assertSameOrigin.mockReturnValue(undefined);
    mocks.clearOwnWrongQuestions.mockResolvedValue(clearResult);
    mocks.clearStudentWrongQuestions.mockResolvedValue(clearResult);
  });

  it("lets a student clear their own wrong questions when permitted", async () => {
    const response = await studentClearPOST(postRequest("http://localhost/api/v1/student/wrong/clear"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(clearResult);
    expect(mocks.clearOwnWrongQuestions).toHaveBeenCalledWith("student-1");
  });

  it("propagates a blocked student self-clear as 403", async () => {
    mocks.clearOwnWrongQuestions.mockRejectedValue(new ApiError("当前未开放学生自助清除错题，请联系老师", 403));

    const response = await studentClearPOST(postRequest("http://localhost/api/v1/student/wrong/clear"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "当前未开放学生自助清除错题，请联系老师" });
  });

  it("lets a teacher clear a specific student's wrong questions", async () => {
    const response = await teacherClearPOST(
      postRequest("http://localhost/api/v1/teacher/students/student-1/wrong/clear"),
      { params: Promise.resolve({ id: "student-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(clearResult);
    expect(mocks.clearStudentWrongQuestions).toHaveBeenCalledWith("teacher-1", "student-1");
  });

  it("rejects non-teachers from the teacher clear endpoint", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));

    const response = await teacherClearPOST(
      postRequest("http://localhost/api/v1/teacher/students/student-1/wrong/clear"),
      { params: Promise.resolve({ id: "student-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.clearStudentWrongQuestions).not.toHaveBeenCalled();
  });
});
