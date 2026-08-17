import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTodayReviewPlan: vi.fn(),
  completeReviewCard: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/review-plan-service", () => ({
  getTodayReviewPlan: mocks.getTodayReviewPlan,
  completeReviewCard: mocks.completeReviewCard,
}));

import { GET as todayGET } from "@/app/api/v1/review-plans/today/route";
import { POST as completePOST } from "@/app/api/v1/review-plans/[planId]/cards/[cardId]/complete/route";

const baseUser = { id: "user-1", username: "student", displayName: "Student", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: "ACTIVE", isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

const plan = {
  id: "plan-1",
  planDate: "2026-08-18",
  type: "DAILY",
  status: "ACTIVE",
  examDate: null,
  completedAt: null,
  total: 1,
  completed: 0,
  cards: [
    {
      id: "card-1",
      questionId: "q-1",
      knowledgePointId: "kp-1",
      knowledgeName: "知识点一",
      levelCode: "A",
      stem: "题干",
      source: "WRONG_QUESTION",
      priority: 1001,
      status: "PENDING",
      completedAt: null,
      launchHref: "/student/practice/start?mode=wrong&question=q-1",
    },
  ],
};

const completedCard = {
  ...plan.cards[0],
  status: "COMPLETED",
  completedAt: "2026-08-18T00:00:00.000Z",
};

describe("review plan student routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(student);
    mocks.getTodayReviewPlan.mockResolvedValue(plan);
    mocks.completeReviewCard.mockResolvedValue(completedCard);
  });

  it("GET today returns the generated daily plan for active students", async () => {
    const response = await todayGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(plan);
    expect(mocks.getTodayReviewPlan).toHaveBeenCalledWith("user-1");
  });

  it("GET today rejects teachers", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const response = await todayGET();
    expect(response.status).toBe(403);
    expect(mocks.getTodayReviewPlan).not.toHaveBeenCalled();
  });

  it("POST complete marks a review card complete", async () => {
    const request = new Request("http://localhost/api/v1/review-plans/plan-1/cards/card-1/complete", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    });
    const response = await completePOST(request, { params: Promise.resolve({ planId: "plan-1", cardId: "card-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(completedCard);
    expect(mocks.completeReviewCard).toHaveBeenCalledWith("user-1", "plan-1", "card-1");
  });

  it("POST complete rejects teachers", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const request = new Request("http://localhost/api/v1/review-plans/plan-1/cards/card-1/complete", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    });
    const response = await completePOST(request, { params: Promise.resolve({ planId: "plan-1", cardId: "card-1" }) });
    expect(response.status).toBe(403);
    expect(mocks.completeReviewCard).not.toHaveBeenCalled();
  });
});
