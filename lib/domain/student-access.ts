export type AppRole = "ADMIN" | "TEACHER" | "STUDENT";
export type StudentStatus = "PENDING" | "ACTIVE" | "REJECTED";
export type AccessCapability = "FULL_ADMIN" | "FULL_TEACHER" | "FULL_STUDENT" | "REGISTRATION_ONLY" | "ACTIVATION_ONLY";
export type AccessErrorCode =
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_EXPIRED"
  | "ACCOUNT_NOT_YET_VALID"
  | "REGISTRATION_PENDING"
  | "REGISTRATION_REJECTED"
  | "PASSWORD_CHANGE_REQUIRED"
  | "ACTIVATION_REQUIRED";

export type AccountAccessInput = {
  role: AppRole;
  enabled: boolean;
  studentStatus: StudentStatus | null;
  isLongTerm: boolean | null;
  validFrom: string | null;
  validUntil: string | null;
  mustChangePassword: boolean;
  activationRequired?: boolean;
};

export type AccessDecision =
  | { capability: "FULL_ADMIN" | "FULL_TEACHER" | "FULL_STUDENT"; errorCode: null }
  | { capability: "REGISTRATION_ONLY"; errorCode: "REGISTRATION_PENDING" | "REGISTRATION_REJECTED" }
  | { capability: "ACTIVATION_ONLY"; errorCode: "ACTIVATION_REQUIRED" }
  | { capability: null; errorCode: "ACCOUNT_DISABLED" | "ACCOUNT_EXPIRED" | "ACCOUNT_NOT_YET_VALID" | "PASSWORD_CHANGE_REQUIRED" };

type IsoDate = {
  year: number;
  month: number;
  day: number;
  value: string;
};

function parseIsoDate(value: string, field: string): IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date for ${field}: ${value}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year === 0) throw new Error(`Invalid ISO date for ${field}: ${value}`);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid ISO date for ${field}: ${value}`);
  }

  return { year, month, day, value: `${match[1]}-${match[2]}-${match[3]}` };
}

function assertIsoDate(value: string, field: string) {
  return parseIsoDate(value, field).value;
}

export function addCalendarYear(date: string) {
  const { year, month, day } = parseIsoDate(date, "date");
  if (year === 9999) throw new Error(`Calendar year exceeds supported range: ${date}`);
  const targetYear = year + 1;
  const monthEnd = new Date(0);
  monthEnd.setUTCHours(0, 0, 0, 0);
  monthEnd.setUTCFullYear(targetYear, month, 0);
  const lastDay = monthEnd.getUTCDate();
  return `${targetYear.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${Math.min(day, lastDay).toString().padStart(2, "0")}`;
}

export function evaluateAccountAccess(input: AccountAccessInput, today: string): AccessDecision {
  if (!input.enabled) return { capability: null, errorCode: "ACCOUNT_DISABLED" };
  if (input.activationRequired) return { capability: "ACTIVATION_ONLY", errorCode: "ACTIVATION_REQUIRED" };
  if (input.mustChangePassword) return { capability: null, errorCode: "PASSWORD_CHANGE_REQUIRED" };
  if (input.role === "ADMIN") return { capability: "FULL_ADMIN", errorCode: null };
  if (input.role === "TEACHER") return { capability: "FULL_TEACHER", errorCode: null };
  if (input.studentStatus === "PENDING") return { capability: "REGISTRATION_ONLY", errorCode: "REGISTRATION_PENDING" };
  if (input.studentStatus === "REJECTED") return { capability: "REGISTRATION_ONLY", errorCode: "REGISTRATION_REJECTED" };
  if (input.studentStatus !== "ACTIVE") return { capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" };
  if (!input.isLongTerm && (!input.validFrom || !input.validUntil)) return { capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" };
  if (input.isLongTerm) return { capability: "FULL_STUDENT", errorCode: null };
  const normalizedToday = assertIsoDate(today, "today");
  const normalizedValidFrom = assertIsoDate(input.validFrom!, "validFrom");
  const normalizedValidUntil = assertIsoDate(input.validUntil!, "validUntil");
  if (normalizedValidFrom > normalizedValidUntil) throw new Error("validFrom must not be after validUntil");
  if (normalizedValidFrom === normalizedValidUntil) throw new Error("validUntil must be after validFrom");

  if (normalizedToday < normalizedValidFrom) return { capability: null, errorCode: "ACCOUNT_NOT_YET_VALID" };
  if (normalizedToday > normalizedValidUntil) return { capability: null, errorCode: "ACCOUNT_EXPIRED" };
  return { capability: "FULL_STUDENT", errorCode: null };
}
