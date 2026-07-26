import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveGenderFromNationalId,
  normalizeNationalId,
  normalizePhone,
  validateMainlandNationalId,
  validateMainlandPhone,
} from "@/lib/domain/student-identity";

const NATIONAL_ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;
const NATIONAL_ID_CHECKSUMS = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

function nationalIdWithChecksum(firstSeventeenDigits: string) {
  const checksumTotal = NATIONAL_ID_WEIGHTS.reduce(
    (total, weight, index) => total + Number(firstSeventeenDigits[index]) * weight,
    0,
  );

  return `${firstSeventeenDigits}${NATIONAL_ID_CHECKSUMS[checksumTotal % 11]}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("student identity", () => {
  it("normalizes national IDs before validation", () => {
    expect(normalizeNationalId(" 11010519491231002x ")).toBe("11010519491231002X");
  });

  it("validates 18-digit mainland national IDs", () => {
    expect(validateMainlandNationalId("11010519491231002X")).toBe(true);
    expect(validateMainlandNationalId("110105194912310021")).toBe(false);
    expect(validateMainlandNationalId("110105491231002")).toBe(false);
  });

  it("rejects letters in the first seventeen national ID characters", () => {
    expect(validateMainlandNationalId("110105194912310A2X")).toBe(false);
  });

  it("rejects final national ID letters other than X", () => {
    expect(validateMainlandNationalId("11010519491231002A")).toBe(false);
  });

  it("rejects impossible birth dates even when the checksum is correct", () => {
    expect(validateMainlandNationalId(nationalIdWithChecksum("11010519490230002"))).toBe(false);
  });

  it("accepts February 29 in a leap year", () => {
    expect(validateMainlandNationalId(nationalIdWithChecksum("11010520000229002"))).toBe(true);
  });

  it("rejects February 29 in a non-leap year", () => {
    expect(validateMainlandNationalId(nationalIdWithChecksum("11010519000229002"))).toBe(false);
  });

  it("rejects zero month and day values", () => {
    expect(validateMainlandNationalId(nationalIdWithChecksum("11010520000029002"))).toBe(false);
    expect(validateMainlandNationalId(nationalIdWithChecksum("11010520000200002"))).toBe(false);
  });

  it("rejects birth dates later than the current UTC date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T00:00:00Z"));

    expect(validateMainlandNationalId(nationalIdWithChecksum("11010520270101002"))).toBe(false);
  });

  it("rejects sequence code 000 even when the checksum is correct", () => {
    expect(validateMainlandNationalId(nationalIdWithChecksum("11010519491231000"))).toBe(false);
  });

  it("derives gender from the seventeenth national ID digit", () => {
    expect(deriveGenderFromNationalId("11010519491231002X")).toBe("FEMALE");
    expect(deriveGenderFromNationalId("110105194912310038")).toBe("MALE");
    expect(deriveGenderFromNationalId("110105194902300029")).toBeNull();
  });

  it("normalizes and validates mainland mobile numbers", () => {
    expect(normalizePhone(" 138 0013 8000 ")).toBe("13800138000");
    expect(validateMainlandPhone("13800138000")).toBe(true);
    expect(validateMainlandPhone("19912345678")).toBe(true);
    expect(validateMainlandPhone("12800138000")).toBe(false);
    expect(validateMainlandPhone("1380013800")).toBe(false);
    expect(validateMainlandPhone("138-0013-8000")).toBe(false);
  });
});
