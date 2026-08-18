import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  levelFindMany: vi.fn(),
  levelCreate: vi.fn(),
  levelFindUnique: vi.fn(),
  levelUpdateMany: vi.fn(),
  levelUpdate: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db", () => ({
  prisma: {
    level: {
      findMany: mocks.levelFindMany,
      create: mocks.levelCreate,
      findUnique: mocks.levelFindUnique,
      updateMany: mocks.levelUpdateMany,
      update: mocks.levelUpdate,
    },
  },
}));

import { GET, POST } from "@/app/api/v1/teacher/levels/route";
import { PUT } from "@/app/api/v1/teacher/levels/[id]/route";
import { POST as disableLevel } from "@/app/api/v1/teacher/levels/[id]/disable/route";
import { ApiError } from "@/lib/domain/api-error";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

const levels = [
  { id: "level-a", code: "A", name: "基础掌握", sortOrder: 1, enabled: true, updatedAt: new Date("2026-08-21T08:00:00.000Z"), _count: { questions: 3 } },
  { id: "level-k", code: "K", name: "K 类综合", sortOrder: 2, enabled: false, updatedAt: new Date("2026-08-21T09:00:00.000Z"), _count: { questions: 0 } },
];

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("teacher level maintenance API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
  });

  it("requires a teacher and lists levels with question counts", async () => {
    mocks.levelFindMany.mockResolvedValue(levels);
    const response = await GET();
    expect(mocks.requireTeacher).toHaveBeenCalledOnce();
    expect(mocks.levelFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: { _count: { select: { questions: true } } } }));
    expect(await response.json()).toEqual({
      levels: [
        { id: "level-a", code: "A", name: "基础掌握", sortOrder: 1, enabled: true, updatedAt: "2026-08-21T08:00:00.000Z", questionCount: 3 },
        { id: "level-k", code: "K", name: "K 类综合", sortOrder: 2, enabled: false, updatedAt: "2026-08-21T09:00:00.000Z", questionCount: 0 },
      ],
    });
  });

  it("rejects students from listing levels", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.levelFindMany).not.toHaveBeenCalled();
  });

  it("creates a K level and normalizes the code to uppercase", async () => {
    mocks.levelCreate.mockResolvedValue({ id: "level-k" });
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/levels", "POST", { code: "k", name: "K 类综合", sortOrder: 2, enabled: true }));
    expect(response.status).toBe(201);
    expect(mocks.levelCreate).toHaveBeenCalledWith({ data: { code: "K", name: "K 类综合", sortOrder: 2, enabled: true } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "LEVEL_CREATE", metadata: { code: "K", enabled: true } }));
  });

  it("rejects non-letter level codes", async () => {
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/levels", "POST", { code: "K1", name: "无效", sortOrder: 0, enabled: true }));
    expect(response.status).toBe(400);
    expect(mocks.levelCreate).not.toHaveBeenCalled();
  });

  it("maps duplicate level codes to conflict", async () => {
    mocks.levelCreate.mockRejectedValueOnce({ code: "P2002", name: "PrismaClientKnownRequestError", message: "duplicate" });
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/levels", "POST", { code: "K", name: "K 类", sortOrder: 1, enabled: true }));
    expect(response.status).toBe(409);
  });

  it("edits a level name, sort order and enabled state with optimistic lock", async () => {
    mocks.levelFindUnique.mockResolvedValue({ id: "level-a" });
    mocks.levelUpdateMany.mockResolvedValue({ count: 1 });
    const response = await PUT(jsonRequest("http://localhost/api/v1/teacher/levels/level-a", "PUT", {
      name: "基础掌握（新版）", sortOrder: 10, enabled: false, updatedAt: "2026-08-21T08:00:00.000Z",
    }), { params: Promise.resolve({ id: "level-a" }) });
    expect(response.status).toBe(200);
    expect(mocks.levelUpdateMany).toHaveBeenCalledWith({
      where: { id: "level-a", updatedAt: new Date("2026-08-21T08:00:00.000Z") },
      data: { name: "基础掌握（新版）", sortOrder: 10, enabled: false },
    });

    mocks.levelUpdateMany.mockResolvedValueOnce({ count: 0 });
    const conflict = await PUT(jsonRequest("http://localhost/api/v1/teacher/levels/level-a", "PUT", {
      name: "基础掌握", sortOrder: 1, enabled: true, updatedAt: "2026-08-21T08:00:00.000Z",
    }), { params: Promise.resolve({ id: "level-a" }) });
    expect(conflict.status).toBe(409);
  });

  it("disables a level and keeps the action idempotent", async () => {
    mocks.levelFindUnique.mockResolvedValueOnce({ id: "level-a", enabled: true });
    const response = await disableLevel(jsonRequest("http://localhost/api/v1/teacher/levels/level-a/disable", "POST"), { params: Promise.resolve({ id: "level-a" }) });
    expect(response.status).toBe(200);
    expect(mocks.levelUpdate).toHaveBeenCalledWith({ where: { id: "level-a" }, data: { enabled: false } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "LEVEL_DISABLE" }));

    mocks.levelFindUnique.mockResolvedValueOnce({ id: "level-k", enabled: false });
    const alreadyDisabled = await disableLevel(jsonRequest("http://localhost/api/v1/teacher/levels/level-k/disable", "POST"), { params: Promise.resolve({ id: "level-k" }) });
    expect(alreadyDisabled.status).toBe(200);
    expect(mocks.levelUpdate).toHaveBeenCalledTimes(1);
  });
});
