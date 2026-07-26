import { describe, expect, it } from "vitest";
import { getBusinessDate } from "@/lib/server/time";

describe("business date", () => {
  it("formats the date in the configured business time zone", () => {
    const instant = new Date("2026-07-25T16:30:00.000Z");

    expect(getBusinessDate(instant, "Asia/Taipei")).toBe("2026-07-26");
    expect(getBusinessDate(instant, "America/Los_Angeles")).toBe("2026-07-25");
  });
});
