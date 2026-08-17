import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listExplanationReviews: vi.fn(),
  getExplanationReviewDetail: vi.fn(),
  submitExplanationReview: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/ai/explanation-review", () => ({
  EXPLANATION_REVIEW_ACTIONS: ["APPROVE", "REJECT", "APPROVE_WITH_EDITS"],
  listExplanationReviews: mocks.listExplanationReviews,
  getExplanationReviewDetail: mocks.getExplanationReviewDetail,
  submitExplanationReview: mocks.submitExplanationReview,
}));

import { GET as listGET } from "@/app/api/v1/teacher/ai-explanations/route";
import { GET as detailGET } from "@/app/api/v1/teacher/ai-explanations/[id]/route";
import { POST as reviewPOST } from "@/app/api/v1/teacher/ai-explanations/[id]/review/route";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };

const pageResult = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
const headers = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };

describe("teacher AI explanation review routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(teacher);
    mocks.listExplanationReviews.mockResolvedValue(pageResult);
    mocks.getExplanationReviewDetail.mockResolvedValue({ id: "q-1" });
    mocks.submitExplanationReview.mockResolvedValue({ saved: true, status: "APPROVED", version: 3, explanationVersion: 2 });
  });

  it("GET list defaults to DRAFT and returns paginated items for teachers", async () => {
    const response = await listGET(new Request("http://localhost/api/v1/teacher/ai-explanations?page=2"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(pageResult);
    expect(mocks.listExplanationReviews).toHaveBeenCalledWith({
      page: 2,
      pageSize: undefined,
      status: "DRAFT",
      search: undefined,
      levelId: undefined,
    });
  });

  it("GET list rejects students", async () => {
    mocks.getCurrentUser.mockResolvedValue(student);
    const response = await listGET(new Request("http://localhost/api/v1/teacher/ai-explanations"));
    expect(response.status).toBe(403);
    expect(mocks.listExplanationReviews).not.toHaveBeenCalled();
  });

  it("GET detail returns the question explanation detail", async () => {
    const response = await detailGET(new Request("http://localhost/api/v1/teacher/ai-explanations/q-1"), { params: Promise.resolve({ id: "q-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "q-1" });
    expect(mocks.getExplanationReviewDetail).toHaveBeenCalledWith("q-1");
  });

  it("POST review approves with edits", async () => {
    const request = new Request("http://localhost/api/v1/teacher/ai-explanations/q-1/review", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "APPROVE_WITH_EDITS", version: 2, content: { summary: "新解析", knowledge: "讲解", memory: "口诀" } }),
    });
    const response = await reviewPOST(request, { params: Promise.resolve({ id: "q-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, status: "APPROVED", version: 3, explanationVersion: 2 });
    expect(mocks.submitExplanationReview).toHaveBeenCalledWith({
      questionId: "q-1",
      actorUserId: "user-1",
      action: "APPROVE_WITH_EDITS",
      content: { summary: "新解析", knowledge: "讲解", memory: "口诀" },
      rejectReason: undefined,
      version: 2,
    });
  });

  it("POST review rejects with reason", async () => {
    mocks.submitExplanationReview.mockResolvedValue({ saved: true, status: "REJECTED", version: 3, explanationVersion: 2 });
    const request = new Request("http://localhost/api/v1/teacher/ai-explanations/q-1/review", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "REJECT", version: 2, rejectReason: "不够准确" }),
    });
    const response = await reviewPOST(request, { params: Promise.resolve({ id: "q-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "REJECTED" });
  });

  it("POST review requires content for approve-with-edits", async () => {
    const request = new Request("http://localhost/api/v1/teacher/ai-explanations/q-1/review", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "APPROVE_WITH_EDITS", version: 2 }),
    });
    const response = await reviewPOST(request, { params: Promise.resolve({ id: "q-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.submitExplanationReview).not.toHaveBeenCalled();
  });
});
