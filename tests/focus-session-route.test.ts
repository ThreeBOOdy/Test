import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  startFocusSession: vi.fn(),
  getFocusOverview: vi.fn(),
  completeFocusSession: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/focus-service", () => ({
  startFocusSession: mocks.startFocusSession,
  getFocusOverview: mocks.getFocusOverview,
  completeFocusSession: mocks.completeFocusSession,
}));

import { GET, POST } from "@/app/api/v1/focus-sessions/route";
import { POST as completePOST } from "@/app/api/v1/focus-sessions/[id]/complete/route";

const baseUser = { id: "user-1", username: "student", displayName: "Student", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const student = { ...baseUser, role: "STUDENT", capability: "FULL_STUDENT" };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

const focusSession = {
  id: "focus-1",
  status: "IN_PROGRESS",
  targetMinutes: 25,
  targetQuestionCount: null,
  actualMinutes: null,
  actualQuestionCount: null,
  startedAt: "2026-08-17T01:00:00.000Z",
  endedAt: null,
};

const overview = {
  currentStreak: 3,
  todayCheckedIn: true,
  todayFocusMinutes: 25,
  activeFocusSession: focusSession,
};

const headers = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };

describe("focus session routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(student);
    mocks.startFocusSession.mockResolvedValue(focusSession);
    mocks.getFocusOverview.mockResolvedValue(overview);
    mocks.completeFocusSession.mockResolvedValue({ ...focusSession, status: "COMPLETED", actualMinutes: 25, endedAt: "2026-08-17T01:30:00.000Z" });
  });

  it("GET returns the focus overview for students", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(overview);
    expect(mocks.getFocusOverview).toHaveBeenCalledWith("user-1");
  });

  it("GET rejects non-students", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.getFocusOverview).not.toHaveBeenCalled();
  });

  it("POST starts a focus session", async () => {
    const request = new Request("http://localhost/api/v1/focus-sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({ targetMinutes: 25 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(focusSession);
    expect(mocks.startFocusSession).toHaveBeenCalledWith("user-1", { targetMinutes: 25 });
  });

  it("POST rejects a missing target", async () => {
    const request = new Request("http://localhost/api/v1/focus-sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mocks.startFocusSession).not.toHaveBeenCalled();
  });

  it("POST complete ends the active focus session", async () => {
    const request = new Request("http://localhost/api/v1/focus-sessions/focus-1/complete", {
      method: "POST",
      headers,
      body: JSON.stringify({ completed: true }),
    });
    const response = await completePOST(request, { params: Promise.resolve({ id: "focus-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "COMPLETED" });
    expect(mocks.completeFocusSession).toHaveBeenCalledWith("user-1", "focus-1", { completed: true });
  });
});
