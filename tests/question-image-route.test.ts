import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/domain/api-error";

const mocks = vi.hoisted(() => ({
  requireLoggedInUser: vi.fn(),
  apiErrorResponse: vi.fn(),
  getQuestionImage: vi.fn(),
}));

vi.mock("@/lib/server/api", () => ({
  requireLoggedInUser: mocks.requireLoggedInUser,
  apiErrorResponse: mocks.apiErrorResponse,
}));
vi.mock("@/lib/server/question-image", () => ({ getQuestionImage: mocks.getQuestionImage }));

import { GET } from "@/app/api/v1/question-images/[id]/route";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function apiErrorResponseMock(error: unknown) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "error";
  return new Response(JSON.stringify({ message }), { status });
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireLoggedInUser.mockResolvedValue({ id: "student-1", role: "STUDENT", capability: "FULL_STUDENT" });
  mocks.apiErrorResponse.mockImplementation(apiErrorResponseMock);
});

describe("question image read endpoint", () => {
  it("rejects unauthenticated requests", async () => {
    mocks.requireLoggedInUser.mockRejectedValue(new ApiError("请先登录", 401));

    const response = await GET(new Request("http://localhost/api/v1/question-images/img-1"), { params: Promise.resolve({ id: "img-1" }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "请先登录" });
  });

  it("returns the stored binary with the correct content type and immutable long cache headers", async () => {
    mocks.getQuestionImage.mockResolvedValue({ id: "img-1", data: pngBytes, mimeType: "image/png", sizeBytes: pngBytes.length, contentHash: "hash-1" });

    const response = await GET(new Request("http://localhost/api/v1/question-images/img-1"), { params: Promise.resolve({ id: "img-1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("cache-control")).toMatch(/max-age=\d+/);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes);
    expect(mocks.getQuestionImage).toHaveBeenCalledWith("img-1");
  });

  it("returns 404 for unknown image ids", async () => {
    mocks.getQuestionImage.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/question-images/missing"), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "图片不存在" });
  });
});
