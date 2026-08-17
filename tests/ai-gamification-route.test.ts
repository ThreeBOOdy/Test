import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  generateDailyEncouragement: vi.fn(),
  generateMilestoneFeedback: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/ai/gamification", () => ({
  generateDailyEncouragement: mocks.generateDailyEncouragement,
  generateMilestoneFeedback: mocks.generateMilestoneFeedback,
}));

import { GET as encouragementGET } from "@/app/api/v1/ai/encouragement/route";
import { POST as milestonePOST } from "@/app/api/v1/ai/milestone-feedback/route";

const baseUser = { id: "user-1", username: "student", displayName: "Student", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: "ACTIVE", isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

describe("AI gamification routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(student);
  });

  it("GET encouragement returns generated text for active students", async () => {
    mocks.generateDailyEncouragement.mockResolvedValue({
      text: "今天也稳稳前进！",
      model: "mock-model",
      generatedAt: "2026-08-18T12:00:00.000Z",
      disclaimer: "AI 生成，仅供参考",
    });

    const response = await encouragementGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ text: "今天也稳稳前进！", model: "mock-model" });
    expect(mocks.generateDailyEncouragement).toHaveBeenCalledWith("user-1");
  });

  it("GET encouragement falls back when AI is unavailable", async () => {
    mocks.generateDailyEncouragement.mockRejectedValue(new Error("AI down"));

    const response = await encouragementGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.model).toBe("fallback");
    expect(body.text).toContain("保持稳定输出");
  });

  it("GET encouragement rejects teachers", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const response = await encouragementGET();
    expect(response.status).toBe(403);
    expect(mocks.generateDailyEncouragement).not.toHaveBeenCalled();
  });

  it("POST milestone feedback returns generated feedback for active students", async () => {
    mocks.generateMilestoneFeedback.mockResolvedValue({
      text: "干得漂亮！",
      model: "mock-model",
      generatedAt: "2026-08-18T12:00:00.000Z",
      disclaimer: "AI 生成，仅供参考",
    });

    const request = new Request("http://localhost/api/v1/ai/milestone-feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ type: "QUEST_COMPLETE", questTitle: "今日刷题", xpReward: 50 }),
    });
    const response = await milestonePOST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ text: "干得漂亮！" });
    expect(mocks.generateMilestoneFeedback).toHaveBeenCalledWith("user-1", { type: "QUEST_COMPLETE", questTitle: "今日刷题", xpReward: 50 });
  });

  it("POST milestone feedback falls back when AI is unavailable", async () => {
    mocks.generateMilestoneFeedback.mockRejectedValue(new Error("AI down"));

    const request = new Request("http://localhost/api/v1/ai/milestone-feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ type: "QUEST_COMPLETE", questTitle: "今日刷题", xpReward: 50 }),
    });
    const response = await milestonePOST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.model).toBe("fallback");
    expect(body.text).toContain("今日刷题");
  });

  it("POST milestone feedback validates event payload", async () => {
    const request = new Request("http://localhost/api/v1/ai/milestone-feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ type: "UNKNOWN", value: 1 }),
    });
    const response = await milestonePOST(request);
    expect(response.status).toBe(400);
    expect(mocks.generateMilestoneFeedback).not.toHaveBeenCalled();
  });
});
