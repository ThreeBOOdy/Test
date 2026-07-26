export type StudentGender = "MALE" | "FEMALE";

const NATIONAL_ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;
const NATIONAL_ID_CHECKSUMS = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

export function normalizeNationalId(value: string) {
  return value.trim().toUpperCase();
}

export function validateMainlandNationalId(value: string) {
  const nationalId = normalizeNationalId(value);
  return validateNormalizedMainlandNationalId(nationalId);
}

export function deriveGenderFromNationalId(value: string): StudentGender | null {
  const nationalId = normalizeNationalId(value);
  if (!validateNormalizedMainlandNationalId(nationalId)) return null;
  return Number(nationalId[16]) % 2 === 0 ? "FEMALE" : "MALE";
}

function validateNormalizedMainlandNationalId(nationalId: string) {
  if (!/^\d{17}[\dX]$/.test(nationalId)) return false;
  if (!hasValidBirthDate(nationalId.slice(6, 14))) return false;
  if (nationalId.slice(14, 17) === "000") return false;

  const checksumTotal = NATIONAL_ID_WEIGHTS.reduce(
    (total, weight, index) => total + Number(nationalId[index]) * weight,
    0,
  );

  return NATIONAL_ID_CHECKSUMS[checksumTotal % 11] === nationalId[17];
}

export function normalizePhone(value: string) {
  return value.replace(/\s+/g, "");
}

export function validateMainlandPhone(value: string) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value));
}

function hasValidBirthDate(dateValue: string) {
  const year = Number(dateValue.slice(0, 4));
  const month = Number(dateValue.slice(4, 6));
  const day = Number(dateValue.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() <= today
  );
}
