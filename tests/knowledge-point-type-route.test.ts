import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  knowledgePointTypeFindMany: vi.fn(),
  knowledgePointTypeCreate: vi.fn(),
  knowledgePointTypeFindUnique: vi.fn(),
  knowledgePointTypeUpdateMany: vi.fn(),
  knowledgePointTypeUpdate: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgePointType: {
      findMany: mocks.knowledgePointTypeFindMany,
      create: mocks.knowledgePointTypeCreate,
      findUnique: mocks.knowledgePointTypeFindUnique,
      updateMany: mocks.knowledgePointTypeUpdateMany,
      update: mocks.knowledgePointTypeUpdate,
    },
  },
}));

import { GET, POST } from "@/app/api/v1/teacher/knowledge-point-types/route";
import { PUT } from "@/app/api/v1/teacher/knowledge-point-types/[id]/route";
import { POST as disableType } from "@/app/api/v1/teacher/knowledge-point-types/[id]/disable/route";
import { ApiError } from "@/lib/domain/api-error";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

const types = [
  { id: "type-dg", code: "DG", name: "电工基础", sortOrder: 1, enabled: true, updatedAt: new Date("2026-08-21T08:00:00.000Z"), _count: { points: 12 } },
  { id: "type-tx", code: "TX", name: "通信原理", sortOrder: 2, enabled: false, updatedAt: new Date("2026-08-21T09:00:00.000Z"), _count: { points: 0 } },
];

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("teacher knowledge point type maintenance API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
  });

  it("requires a teacher and lists knowledge point types with point counts", async () => {
    mocks.knowledgePointTypeFindMany.mockResolvedValue(types);
    const response = await GET();
    expect(mocks.requireTeacher).toHaveBeenCalledOnce();
    expect(mocks.knowledgePointTypeFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: { _count: { select: { points: true } } } }));
    expect(await response.json()).toEqual({
      types: [
        { id: "type-dg", code: "DG", name: "电工基础", sortOrder: 1, enabled: true, updatedAt: "2026-08-21T08:00:00.000Z", pointCount: 12 },
        { id: "type-tx", code: "TX", name: "通信原理", sortOrder: 2, enabled: false, updatedAt: "2026-08-21T09:00:00.000Z", pointCount: 0 },
      ],
    });
  });

  it("rejects students from listing knowledge point types", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.knowledgePointTypeFindMany).not.toHaveBeenCalled();
  });

  it("creates a type and normalizes the code to uppercase", async () => {
    mocks.knowledgePointTypeCreate.mockResolvedValue({ id: "type-dg" });
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types", "POST", { code: "dg", name: "电工基础", sortOrder: 1, enabled: true }));
    expect(response.status).toBe(201);
    expect(mocks.knowledgePointTypeCreate).toHaveBeenCalledWith({ data: { code: "DG", name: "电工基础", sortOrder: 1, enabled: true } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "KNOWLEDGE_POINT_TYPE_CREATE", metadata: { code: "DG", enabled: true } }));
  });

  it("rejects invalid type codes", async () => {
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types", "POST", { code: "DG 1", name: "无效", sortOrder: 0, enabled: true }));
    expect(response.status).toBe(400);
    expect(mocks.knowledgePointTypeCreate).not.toHaveBeenCalled();
  });

  it("maps duplicate type codes to conflict", async () => {
    mocks.knowledgePointTypeCreate.mockRejectedValueOnce({ code: "P2002", name: "PrismaClientKnownRequestError", message: "duplicate" });
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types", "POST", { code: "DG", name: "电工基础", sortOrder: 1, enabled: true }));
    expect(response.status).toBe(409);
  });

  it("edits a type name, sort order and enabled state with optimistic lock", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValue({ id: "type-dg" });
    mocks.knowledgePointTypeUpdateMany.mockResolvedValue({ count: 1 });
    const response = await PUT(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types/type-dg", "PUT", {
      name: "电工基础（新版）", sortOrder: 10, enabled: false, updatedAt: "2026-08-21T08:00:00.000Z",
    }), { params: Promise.resolve({ id: "type-dg" }) });
    expect(response.status).toBe(200);
    expect(mocks.knowledgePointTypeUpdateMany).toHaveBeenCalledWith({
      where: { id: "type-dg", updatedAt: new Date("2026-08-21T08:00:00.000Z") },
      data: { name: "电工基础（新版）", sortOrder: 10, enabled: false },
    });

    mocks.knowledgePointTypeUpdateMany.mockResolvedValueOnce({ count: 0 });
    const conflict = await PUT(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types/type-dg", "PUT", {
      name: "电工基础", sortOrder: 1, enabled: true, updatedAt: "2026-08-21T08:00:00.000Z",
    }), { params: Promise.resolve({ id: "type-dg" }) });
    expect(conflict.status).toBe(409);
  });

  it("disables a type and keeps the action idempotent", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValueOnce({ id: "type-dg", enabled: true });
    const response = await disableType(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types/type-dg/disable", "POST"), { params: Promise.resolve({ id: "type-dg" }) });
    expect(response.status).toBe(200);
    expect(mocks.knowledgePointTypeUpdate).toHaveBeenCalledWith({ where: { id: "type-dg" }, data: { enabled: false } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "KNOWLEDGE_POINT_TYPE_DISABLE" }));

    mocks.knowledgePointTypeFindUnique.mockResolvedValueOnce({ id: "type-tx", enabled: false });
    const alreadyDisabled = await disableType(jsonRequest("http://localhost/api/v1/teacher/knowledge-point-types/type-tx/disable", "POST"), { params: Promise.resolve({ id: "type-tx" }) });
    expect(alreadyDisabled.status).toBe(200);
    expect(mocks.knowledgePointTypeUpdate).toHaveBeenCalledTimes(1);
  });
});
