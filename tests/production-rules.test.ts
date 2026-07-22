import { afterEach, describe, expect, it, vi } from "vitest";
import { isImportBatchExpired } from "../lib/domain/import-batch";
import { isLoginBlocked, validatePasswordPolicy } from "../lib/domain/security";
import { ApiError, mapPublicError } from "../lib/domain/api-error";
import { getDatabaseSchema } from "../lib/domain/database-url";
import { assertRequestBodySize, readJsonBody } from "../lib/domain/request-body";
import { normalizePagination } from "../lib/server/pagination";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("import batch expiry", () => {
  it("expires previews after 24 hours", () => {
    const createdAt = new Date("2026-07-20T00:00:00.000Z");
    expect(isImportBatchExpired(createdAt, new Date("2026-07-20T23:59:59.000Z"))).toBe(false);
    expect(isImportBatchExpired(createdAt, new Date("2026-07-21T00:00:00.000Z"))).toBe(true);
  });
});

describe("password policy", () => {
  it("requires 10 to 128 characters with letters and numbers", () => {
    expect(validatePasswordPolicy("short1")).toBe("密码至少需要 10 位");
    expect(validatePasswordPolicy("abcdefghij")).toBe("密码必须同时包含字母和数字");
    expect(validatePasswordPolicy("1234567890")).toBe("密码必须同时包含字母和数字");
    expect(validatePasswordPolicy("securePass123")).toBeNull();
  });
});

describe("login throttling", () => {
  it("blocks after five failures inside fifteen minutes", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const recentFailures = Array.from({ length: 5 }, (_, index) => new Date(now.getTime() - index * 60_000));
    expect(isLoginBlocked(recentFailures, now)).toBe(true);
    expect(isLoginBlocked(recentFailures.slice(0, 4), now)).toBe(false);
    expect(isLoginBlocked([new Date("2026-07-21T11:44:59.000Z"), ...recentFailures.slice(0, 4)], now)).toBe(false);
  });
});

describe("pagination", () => {
  it("applies safe defaults and limits", () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 20, skip: 0 });
    expect(normalizePagination({ page: "3", pageSize: "500" })).toEqual({ page: 3, pageSize: 100, skip: 200 });
    expect(normalizePagination({ page: "-1", pageSize: "0" })).toEqual({ page: 1, pageSize: 20, skip: 0 });
  });
});

describe("API error mapping", () => {
  it("preserves typed public API errors", () => {
    expect(mapPublicError(new ApiError("批次已过期", 409), "提交失败", false)).toEqual({ message: "批次已过期", status: 409 });
  });

  it("hides unexpected error details in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(mapPublicError(new Error("database connection details"), "请求失败", true)).toEqual({ message: "请求失败", status: 500 });
  });
});

describe("request body limits", () => {
  it("rejects an oversized multipart request before parsing", () => {
    const request = new Request("http://localhost/api", { method: "POST", headers: { "content-length": "21" }, body: "file" });
    expect(() => assertRequestBodySize(request, 20)).toThrowError(new ApiError("请求体过大", 413));
  });

  it("rejects declared and streamed JSON bodies above the limit", async () => {
    const declared = new Request("http://localhost/api", { method: "POST", headers: { "content-length": "20" }, body: "{}" });
    await expect(readJsonBody(declared, 10)).rejects.toMatchObject({ status: 413 });

    const streamed = new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ value: "1234567890" }) });
    await expect(readJsonBody(streamed, 10)).rejects.toMatchObject({ status: 413 });
  });

  it("parses valid JSON and rejects malformed JSON", async () => {
    const valid = new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ value: 1 }) });
    await expect(readJsonBody(valid, 1024)).resolves.toEqual({ value: 1 });

    const malformed = new Request("http://localhost/api", { method: "POST", body: "{" });
    await expect(readJsonBody(malformed, 1024)).rejects.toEqual(new ApiError("请求体不是有效 JSON", 400));
  });
});

describe("database URL schema", () => {
  it("uses the configured PostgreSQL schema and defaults to public", () => {
    expect(getDatabaseSchema("postgresql://user:pass@localhost:5432/app?schema=tenant_a")).toBe("tenant_a");
    expect(getDatabaseSchema("postgresql://user:pass@localhost:5432/app")).toBe("public");
  });
});
