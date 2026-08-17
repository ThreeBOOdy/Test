import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPlayerStatus: vi.fn(),
  getTodayQuests: vi.fn(),
  completeQuest: vi.fn(),
  setGamificationEnabled: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/rpg-service", () => ({
  getPlayerStatus: mocks.getPlayerStatus,
  getTodayQuests: mocks.getTodayQuests,
  completeQuest: mocks.completeQuest,
  setGamificationEnabled: mocks.setGamificationEnabled,
}));

import { GET as statusGET } from "@/app/api/v1/rpg/status/route";
import { GET as questsGET } from "@/app/api/v1/rpg/quests/today/route";
import { POST as completePOST } from "@/app/api/v1/rpg/quests/[id]/complete/route";
import { PATCH as profilePATCH } from "@/app/api/v1/rpg/profile/route";

const baseUser = { id: "user-1", username: "student", displayName: "Student", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: "ACTIVE", isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

const quest = {
  id: "quest-practice",
  questDate: "2026-08-18",
  type: "PRACTICE",
  title: "今日刷题",
  description: "在完成的练习中累计答完题目",
  target: 20,
  progress: 20,
  status: "IN_PROGRESS",
  ready: true,
  xpReward: 50,
  completedAt: null,
};

const status = {
  xp: 50,
  level: 1,
  title: "见习报务员",
  currentLevelXp: 0,
  nextLevelXp: 80,
  levelProgress: 62,
  gamificationEnabled: true,
  todayQuests: [quest],
};

describe("rpg student routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(student);
    mocks.getPlayerStatus.mockResolvedValue(status);
    mocks.getTodayQuests.mockResolvedValue([quest]);
    mocks.completeQuest.mockResolvedValue({ ...quest, status: "COMPLETED", ready: false, completedAt: "2026-08-18T12:00:00.000Z" });
    mocks.setGamificationEnabled.mockResolvedValue(status);
  });

  it("GET status returns player status for active students", async () => {
    const response = await statusGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(status);
    expect(mocks.getPlayerStatus).toHaveBeenCalledWith("user-1");
  });

  it("GET status rejects teachers", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const response = await statusGET();
    expect(response.status).toBe(403);
    expect(mocks.getPlayerStatus).not.toHaveBeenCalled();
  });

  it("GET today quests returns the daily quest list", async () => {
    const response = await questsGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([quest]);
    expect(mocks.getTodayQuests).toHaveBeenCalledWith("user-1");
  });

  it("POST complete claims a ready quest", async () => {
    const request = new Request("http://localhost/api/v1/rpg/quests/quest-practice/complete", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    });
    const response = await completePOST(request, { params: Promise.resolve({ id: "quest-practice" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "COMPLETED" });
    expect(mocks.completeQuest).toHaveBeenCalledWith("user-1", "quest-practice");
  });

  it("POST complete rejects teachers", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const request = new Request("http://localhost/api/v1/rpg/quests/quest-practice/complete", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    });
    const response = await completePOST(request, { params: Promise.resolve({ id: "quest-practice" }) });
    expect(response.status).toBe(403);
    expect(mocks.completeQuest).not.toHaveBeenCalled();
  });

  it("PATCH profile toggles gamification for students", async () => {
    const request = new Request("http://localhost/api/v1/rpg/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ gamificationEnabled: false }),
    });
    const response = await profilePATCH(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(status);
    expect(mocks.setGamificationEnabled).toHaveBeenCalledWith("user-1", false);
  });

  it("PATCH profile rejects teachers", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const request = new Request("http://localhost/api/v1/rpg/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ gamificationEnabled: false }),
    });
    const response = await profilePATCH(request);
    expect(response.status).toBe(403);
    expect(mocks.setGamificationEnabled).not.toHaveBeenCalled();
  });
});
