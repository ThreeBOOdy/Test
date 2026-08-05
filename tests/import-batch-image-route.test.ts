import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/domain/api-error";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  apiErrorResponse: vi.fn(),
  getImportBatchImage: vi.fn(),
}));

vi.mock("@/lib/server/api", () => ({
  requireTeacher: mocks.requireTeacher,
  apiErrorResponse: mocks.apiErrorResponse,
}));
vi.mock("@/lib/server/import-service", () => ({ getImportBatchImage: mocks.getImportBatchImage }));

import { GET } from "@/app/api/v1/teacher/import-batches/[id]/images/[imageId]/route";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function apiErrorResponseMock(error: unknown) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "error";
  return new Response(JSON.stringify({ message }), { status });
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireTeacher.mockResolvedValue({ id: "teacher-1", role: "TEACHER", capability: "FULL_TEACHER" });
  mocks.apiErrorResponse.mockImplementation(apiErrorResponseMock);
});

describe("import batch image read endpoint", () => {
  it("serves a batch image to the owning teacher with the correct content type", async () => {
    mocks.getImportBatchImage.mockResolvedValue({ id: "qimg_1", data: pngBytes, mimeType: "image/png", sizeBytes: pngBytes.length });

    const response = await GET(new Request("http://localhost/api/v1/teacher/import-batches/batch-1/images/qimg_1"), { params: Promise.resolve({ id: "batch-1", imageId: "qimg_1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(pngBytes.length));
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes);
    expect(mocks.getImportBatchImage).toHaveBeenCalledWith("teacher-1", "batch-1", "qimg_1");
  });

  it("rejects non-teacher access before resolving the image", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("请先登录", 401));

    const response = await GET(new Request("http://localhost/api/v1/teacher/import-batches/batch-1/images/qimg_1"), { params: Promise.resolve({ id: "batch-1", imageId: "qimg_1" }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "请先登录" });
    expect(mocks.getImportBatchImage).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown images or batches", async () => {
    mocks.getImportBatchImage.mockRejectedValue(new ApiError("图片不存在", 404));

    const response = await GET(new Request("http://localhost/api/v1/teacher/import-batches/batch-1/images/missing"), { params: Promise.resolve({ id: "batch-1", imageId: "missing" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "图片不存在" });
  });
});
