import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  knowledgePointTypeFindUnique: vi.fn(),
  knowledgePointFindMany: vi.fn(),
  knowledgePointFindFirst: vi.fn(),
  getOrCreateDefaultKnowledgePointType: vi.fn(),
  ensureKnowledgePoint: vi.fn(),
  writeAuditLogInTransaction: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.writeAuditLogInTransaction }));
vi.mock("@/lib/server/knowledge-service", () => ({
  getOrCreateDefaultKnowledgePointType: mocks.getOrCreateDefaultKnowledgePointType,
  ensureKnowledgePoint: mocks.ensureKnowledgePoint,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgePointType: { findUnique: mocks.knowledgePointTypeFindUnique },
    knowledgePoint: { findMany: mocks.knowledgePointFindMany, findFirst: mocks.knowledgePointFindFirst },
    $transaction: vi.fn((callback: (transaction: object) => unknown) => callback({
      knowledgePointType: { findUnique: mocks.knowledgePointTypeFindUnique },
      knowledgePoint: { findFirst: mocks.knowledgePointFindFirst },
    })),
  },
}));

import { GET, POST } from "@/app/api/v1/teacher/knowledge-points/route";
import { ApiError } from "@/lib/domain/api-error";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("teacher knowledge point API under knowledge types", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.getOrCreateDefaultKnowledgePointType.mockResolvedValue({ id: "type-default" });
    mocks.ensureKnowledgePoint.mockResolvedValue({ id: "point-1", typeId: "type-dg", version: 1 });
  });

  it("lists knowledge points filtered by typeId", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValue({ id: "type-dg" });
    mocks.knowledgePointFindMany.mockResolvedValue([
      {
        id: "point-1",
        typeId: "type-dg",
        type: { id: "type-dg", code: "DG", name: "电工基础" },
        code: "4.1.1",
        name: "导体和绝缘体",
        path: "/4/4.1/4.1.1",
        depth: 2,
        sortOrder: 1,
        enabled: true,
        version: 3,
        _count: { children: 0, questions: 2 },
      },
    ]);
    const response = await GET(new Request("http://localhost/api/v1/teacher/knowledge-points?typeId=type-dg"));
    expect(response.status).toBe(200);
    expect(mocks.knowledgePointFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { typeId: "type-dg" } }));
    expect(await response.json()).toEqual({
      typeId: "type-dg",
      points: [
        {
          id: "point-1",
          typeId: "type-dg",
          type: { id: "type-dg", code: "DG", name: "电工基础" },
          code: "4.1.1",
          name: "导体和绝缘体",
          path: "/4/4.1/4.1.1",
          depth: 2,
          sortOrder: 1,
          enabled: true,
          version: 3,
          childCount: 0,
          questionCount: 2,
        },
      ],
    });
  });

  it("returns 404 when the requested type does not exist", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/teacher/knowledge-points?typeId=missing"));
    expect(response.status).toBe(404);
    expect(mocks.knowledgePointFindMany).not.toHaveBeenCalled();
  });

  it("creates a knowledge point under the requested enabled type", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValue({ id: "type-dg", enabled: true });
    mocks.knowledgePointFindFirst.mockResolvedValue(null);
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-points", "POST", {
      code: "4.1.1",
      name: "导体和绝缘体",
      sortOrder: 1,
      typeId: "type-dg",
    }));
    expect(response.status).toBe(201);
    expect(mocks.ensureKnowledgePoint).toHaveBeenCalledWith(expect.anything(), "4.1.1", "导体和绝缘体", 1, "type-dg");
    expect(mocks.writeAuditLogInTransaction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "KNOWLEDGE_CREATE", metadata: { typeId: "type-dg", version: 1 } }));
  });

  it("rejects creating a knowledge point under a disabled type", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValue({ id: "type-tx", enabled: false });
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-points", "POST", {
      code: "1.1",
      name: "停用类型下的知识点",
      sortOrder: 0,
      typeId: "type-tx",
    }));
    expect(response.status).toBe(409);
    expect(mocks.ensureKnowledgePoint).not.toHaveBeenCalled();
  });

  it("falls back to the default knowledge point type when typeId is omitted", async () => {
    mocks.knowledgePointFindFirst.mockResolvedValue(null);
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-points", "POST", {
      code: "9.1",
      name: "默认类型知识点",
      sortOrder: 0,
    }));
    expect(response.status).toBe(201);
    expect(mocks.knowledgePointTypeFindUnique).not.toHaveBeenCalled();
    expect(mocks.ensureKnowledgePoint).toHaveBeenCalledWith(expect.anything(), "9.1", "默认类型知识点", 0, "type-default");
  });

  it("rejects duplicate classification codes within the same type", async () => {
    mocks.knowledgePointTypeFindUnique.mockResolvedValue({ id: "type-dg", enabled: true });
    mocks.knowledgePointFindFirst.mockResolvedValue({ id: "point-1" });
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/knowledge-points", "POST", {
      code: "4.1.1",
      name: "重复分类号",
      sortOrder: 0,
      typeId: "type-dg",
    }));
    expect(response.status).toBe(409);
    expect(mocks.ensureKnowledgePoint).not.toHaveBeenCalled();
  });

  it("maps missing teacher access to 403", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));
    const response = await GET(new Request("http://localhost/api/v1/teacher/knowledge-points"));
    expect(response.status).toBe(403);
    expect(mocks.knowledgePointFindMany).not.toHaveBeenCalled();
  });
});
