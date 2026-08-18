import { describe, expect, it } from "vitest";
import { isLevelCode, normalizeLevelCode } from "@/lib/domain/level-code";

describe("level code", () => {
  it("accepts single and multi-letter codes", () => {
    expect(isLevelCode("A")).toBe(true);
    expect(isLevelCode("K")).toBe(true);
    expect(isLevelCode("AA")).toBe(true);
    expect(isLevelCode("abc")).toBe(true);
  });

  it("rejects non-letter codes", () => {
    expect(isLevelCode("1")).toBe(false);
    expect(isLevelCode("A1")).toBe(false);
    expect(isLevelCode("A-")).toBe(false);
    expect(isLevelCode("")).toBe(false);
  });

  it("normalizes codes to uppercase trimmed form", () => {
    expect(normalizeLevelCode(" k ")).toBe("K");
    expect(normalizeLevelCode("aa")).toBe("AA");
  });
});
