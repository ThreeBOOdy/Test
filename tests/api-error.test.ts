import { describe, expect, it } from "vitest";
import { apiError } from "@/lib/server/api";
import { ServerConfigurationError } from "@/lib/server/env";

describe("API error responses", () => {
  it("does not expose server configuration details in development", () => {
    const error = new ServerConfigurationError("STUDENT_DATA_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");

    expect(apiError(error, "注册失败")).toEqual({ message: "注册失败", status: 500 });
  });
});
