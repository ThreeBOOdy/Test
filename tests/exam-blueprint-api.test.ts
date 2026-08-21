import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  listExamBlueprints: vi.fn(),
  createExamBlueprint: vi.fn(),
  getExamBlueprint: vi.fn(),
  updateExamBlueprint: vi.fn(),
  deleteExamBlueprint: vi.fn(),
  copyExamBlueprint: vi.fn(),
  addExamBlueprintItem: vi.fn(),
  updateExamBlueprintItem: vi.fn(),
  deleteExamBlueprintItem: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});

vi.mock("@/lib/server/exam-blueprint-service", () => ({
  listExamBlueprints: mocks.listExamBlueprints,
  createExamBlueprint: mocks.createExamBlueprint,
  getExamBlueprint: mocks.getExamBlueprint,
  updateExamBlueprint: mocks.updateExamBlueprint,
  deleteExamBlueprint: mocks.deleteExamBlueprint,
  copyExamBlueprint: mocks.copyExamBlueprint,
  addExamBlueprintItem: mocks.addExamBlueprintItem,
  updateExamBlueprintItem: mocks.updateExamBlueprintItem,
  deleteExamBlueprintItem: mocks.deleteExamBlueprintItem,
}));

import { GET, POST } from "@/app/api/v1/teacher/exam-blueprints/route";
import { DELETE, GET as getBlueprint, PUT } from "@/app/api/v1/teacher/exam-blueprints/[id]/route";
import { POST as copyBlueprint } from "@/app/api/v1/teacher/exam-blueprints/[id]/copy/route";
import { GET as listItems, POST as addItem } from "@/app/api/v1/teacher/exam-blueprints/[id]/items/route";
import { DELETE as deleteItem, PUT as updateItem } from "@/app/api/v1/teacher/exam-blueprints/[id]/items/[itemId]/route";
import { ApiError } from "@/lib/domain/api-error";

const baseUser = { id: "user-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

const blueprint = {
  id: "blueprint-1",
  levelId: "level-a",
  name: "期中模拟",
  durationMinutes: 40,
  passingCount: 30,
  enabled: true,
  isDefault: false,
  createdAt: new Date("2026-08-21T08:00:00.000Z"),
  updatedAt: new Date("2026-08-21T08:00:00.000Z"),
  items: [
    {
      id: "item-1",
      blueprintId: "blueprint-1",
      knowledgePointId: "kp-1",
      singleCount: 20,
      multipleCount: 2,
      knowledgePoint: { id: "kp-1", code: "1.1", name: "电波基础", path: "/1/1.1" },
    },
  ],
};

const mappedBlueprint = {
  id: "blueprint-1",
  levelId: "level-a",
  name: "期中模拟",
  durationMinutes: 40,
  passingCount: 30,
  enabled: true,
  isDefault: false,
  totalCount: 22,
  createdAt: "2026-08-21T08:00:00.000Z",
  updatedAt: "2026-08-21T08:00:00.000Z",
  items: [
    {
      id: "item-1",
      blueprintId: "blueprint-1",
      knowledgePointId: "kp-1",
      knowledgePoint: { id: "kp-1", code: "1.1", name: "电波基础", path: "/1/1.1" },
      singleCount: 20,
      multipleCount: 2,
    },
  ],
};

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("teacher exam blueprint API (issue #19)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.listExamBlueprints.mockResolvedValue([blueprint]);
    mocks.createExamBlueprint.mockResolvedValue({ id: "blueprint-1" });
    mocks.getExamBlueprint.mockResolvedValue(blueprint);
    mocks.updateExamBlueprint.mockResolvedValue({ id: "blueprint-1" });
    mocks.deleteExamBlueprint.mockResolvedValue({ deleted: true });
    mocks.copyExamBlueprint.mockResolvedValue({ id: "blueprint-2" });
    mocks.addExamBlueprintItem.mockResolvedValue({ id: "item-new" });
    mocks.updateExamBlueprintItem.mockResolvedValue({ id: "item-1" });
    mocks.deleteExamBlueprintItem.mockResolvedValue({ deleted: true });
  });

  it("lists blueprints for a level", async () => {
    const response = await GET(new Request("http://localhost/api/v1/teacher/exam-blueprints?levelId=level-a"));
    expect(response.status).toBe(200);
    expect(mocks.listExamBlueprints).toHaveBeenCalledWith("level-a");
    expect(await response.json()).toEqual({ blueprints: [mappedBlueprint] });
  });

  it("creates a blueprint", async () => {
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints", "POST", {
      levelId: "level-a",
      name: "期中模拟",
      durationMinutes: 40,
      passingCount: 30,
      enabled: true,
      isDefault: false,
      items: [{ knowledgePointId: "kp-1", singleCount: 20, multipleCount: 2 }],
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "blueprint-1" });
    expect(mocks.createExamBlueprint).toHaveBeenCalledWith("user-1", expect.objectContaining({ levelId: "level-a", name: "期中模拟", items: [{ knowledgePointId: "kp-1", singleCount: 20, multipleCount: 2 }] }));
  });

  it("returns 400 for a blueprint with no items", async () => {
    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints", "POST", {
      levelId: "level-a",
      name: "空蓝图",
      durationMinutes: 40,
      passingCount: 30,
      enabled: true,
      isDefault: false,
      items: [],
    }));

    expect(response.status).toBe(400);
    expect(mocks.createExamBlueprint).not.toHaveBeenCalled();
  });

  it("maps inventory shortage to a clear 409 error", async () => {
    mocks.createExamBlueprint.mockRejectedValue(new ApiError("知识点“电波基础”（1.1）单选库存不足：需要 10 题，当前仅 5 题，缺少 5 题", 409));

    const response = await POST(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints", "POST", {
      levelId: "level-a",
      name: "库存不足",
      durationMinutes: 40,
      passingCount: 5,
      enabled: true,
      isDefault: false,
      items: [{ knowledgePointId: "kp-1", singleCount: 10, multipleCount: 0 }],
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "知识点“电波基础”（1.1）单选库存不足：需要 10 题，当前仅 5 题，缺少 5 题" });
  });

  it("gets a single blueprint", async () => {
    const response = await getBlueprint(new Request("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1"), { params: Promise.resolve({ id: "blueprint-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      blueprint: {
        ...blueprint,
        createdAt: "2026-08-21T08:00:00.000Z",
        updatedAt: "2026-08-21T08:00:00.000Z",
      },
    });
  });

  it("updates a blueprint", async () => {
    const response = await PUT(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1", "PUT", {
      name: "期末模拟",
      durationMinutes: 60,
      passingCount: 40,
      enabled: true,
      isDefault: true,
      items: [{ knowledgePointId: "kp-1", singleCount: 30, multipleCount: 10 }],
    }), { params: Promise.resolve({ id: "blueprint-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, id: "blueprint-1" });
    expect(mocks.updateExamBlueprint).toHaveBeenCalledWith("user-1", "blueprint-1", expect.objectContaining({ name: "期末模拟", isDefault: true }));
  });

  it("deletes a blueprint", async () => {
    const response = await DELETE(new Request("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1"), { params: Promise.resolve({ id: "blueprint-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(mocks.deleteExamBlueprint).toHaveBeenCalledWith("user-1", "blueprint-1");
  });

  it("copies a blueprint", async () => {
    const response = await copyBlueprint(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1/copy", "POST", {}), { params: Promise.resolve({ id: "blueprint-1" }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "blueprint-2" });
    expect(mocks.copyExamBlueprint).toHaveBeenCalledWith("user-1", "blueprint-1", {});
  });

  it("lists items for a blueprint", async () => {
    const response = await listItems(new Request("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1/items"), { params: Promise.resolve({ id: "blueprint-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: blueprint.items });
  });

  it("adds an item to a blueprint", async () => {
    const response = await addItem(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1/items", "POST", {
      knowledgePointId: "kp-2",
      singleCount: 5,
      multipleCount: 1,
    }), { params: Promise.resolve({ id: "blueprint-1" }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "item-new" });
    expect(mocks.addExamBlueprintItem).toHaveBeenCalledWith("user-1", "blueprint-1", { knowledgePointId: "kp-2", singleCount: 5, multipleCount: 1 });
  });

  it("updates an item", async () => {
    const response = await updateItem(jsonRequest("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1/items/item-1", "PUT", {
      knowledgePointId: "kp-2",
      singleCount: 6,
      multipleCount: 2,
    }), { params: Promise.resolve({ id: "blueprint-1", itemId: "item-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, id: "item-1" });
    expect(mocks.updateExamBlueprintItem).toHaveBeenCalledWith("user-1", "blueprint-1", "item-1", { knowledgePointId: "kp-2", singleCount: 6, multipleCount: 2 });
  });

  it("deletes an item", async () => {
    const response = await deleteItem(new Request("http://localhost/api/v1/teacher/exam-blueprints/blueprint-1/items/item-1"), { params: Promise.resolve({ id: "blueprint-1", itemId: "item-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(mocks.deleteExamBlueprintItem).toHaveBeenCalledWith("user-1", "blueprint-1", "item-1");
  });

  it("rejects non-teachers with 403", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));
    const response = await GET(new Request("http://localhost/api/v1/teacher/exam-blueprints"));
    expect(response.status).toBe(403);
    expect(mocks.listExamBlueprints).not.toHaveBeenCalled();
  });
});
