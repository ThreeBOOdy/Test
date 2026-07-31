import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertProductionStudentDataEnvironment, getBusinessTimeZone, getStudentDataSecrets } from "@/lib/server/env";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  hashSensitiveValue,
  maskNationalId,
  maskPhone,
} from "@/lib/server/student-sensitive-data";

const encryptionKey = Buffer.alloc(32, 17).toString("base64");
const hashKey = Buffer.alloc(32, 29).toString("base64");

beforeEach(() => {
  vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", encryptionKey);
  vi.stubEnv("STUDENT_DATA_HASH_KEY", hashKey);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("student data secrets", () => {
  it("accepts exact 32-byte Base64 keys and defaults the business time zone", () => {
    const secrets = getStudentDataSecrets();

    expect(secrets.encryptionKey).toEqual(Buffer.alloc(32, 17));
    expect(secrets.hashKey).toEqual(Buffer.alloc(32, 29));
    expect(getBusinessTimeZone()).toBe("Asia/Taipei");
  });

  it("rejects missing or malformed keys without exposing their values", () => {
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", "not-a-valid-secret-value");
    vi.stubEnv("STUDENT_DATA_HASH_KEY", "");

    expect(() => getStudentDataSecrets()).toThrowError("STUDENT_DATA_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");
    expect(() => getStudentDataSecrets()).not.toThrowError(/not-a-valid-secret-value/);
  });

  it.each([31, 33])("rejects a valid Base64 key containing %i bytes", (byteLength) => {
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", Buffer.alloc(byteLength, 41).toString("base64"));

    expect(() => getStudentDataSecrets()).toThrowError("STUDENT_DATA_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");
  });

  it("rejects a missing hash key after accepting the encryption key", () => {
    vi.stubEnv("STUDENT_DATA_HASH_KEY", "");

    expect(() => getStudentDataSecrets()).toThrowError("STUDENT_DATA_HASH_KEY must be a Base64-encoded 32-byte key");
  });

  it("rejects using the same key for encryption and hashing", () => {
    vi.stubEnv("STUDENT_DATA_HASH_KEY", encryptionKey);

    expect(() => getStudentDataSecrets()).toThrowError("STUDENT_DATA_ENCRYPTION_KEY and STUDENT_DATA_HASH_KEY must be different");
  });

  it.each([
    ["STUDENT_DATA_ENCRYPTION_KEY", hashKey],
    ["STUDENT_DATA_HASH_KEY", encryptionKey],
  ] as const)("rejects a missing production %s without exposing the other value", (missingName, presentValue) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", missingName === "STUDENT_DATA_ENCRYPTION_KEY" ? "" : encryptionKey);
    vi.stubEnv("STUDENT_DATA_HASH_KEY", missingName === "STUDENT_DATA_HASH_KEY" ? "" : hashKey);

    let thrown: unknown;
    try {
      assertProductionStudentDataEnvironment();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(`${missingName} must be a Base64-encoded 32-byte key`);
    expect((thrown as Error).message).not.toContain(presentValue);
  });

  it("does not require student data keys at development startup", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", "");
    vi.stubEnv("STUDENT_DATA_HASH_KEY", "");

    expect(() => assertProductionStudentDataEnvironment()).not.toThrow();
  });
});

describe("student sensitive data protection", () => {
  it("round-trips an encrypted national ID with a random IV", () => {
    const nationalId = "11010519491231002X";
    const first = encryptSensitiveValue(nationalId);
    const second = encryptSensitiveValue(nationalId);

    expect(first).toMatch(/^v2\.default\.[A-Za-z0-9_-]+$/);
    expect(second).not.toBe(first);
    expect(decryptSensitiveValue(first)).toBe(nationalId);
    expect(decryptSensitiveValue(second)).toBe(nationalId);
  });

  it("rejects a tampered authentication tag", () => {
    const encrypted = encryptSensitiveValue("11010519491231002X");
    const [version, keyId, payload] = encrypted.split(".");
    const bytes = Buffer.from(payload!, "base64url");
    bytes[bytes.length - 1] ^= 1;

    expect(() => decryptSensitiveValue(`${version}.${keyId}.${bytes.toString("base64url")}`)).toThrowError("Sensitive value authentication failed");
  });

  it("uses the current key ID for writes while retaining old key decryption", () => {
    const oldKey = Buffer.alloc(32, 47).toString("base64");
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", oldKey);
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY_ID", "old-key");
    const oldCiphertext = encryptSensitiveValue("13800138000");

    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", encryptionKey);
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY_ID", "new-key");
    vi.stubEnv("STUDENT_DATA_DECRYPTION_KEYS", JSON.stringify({ "old-key": oldKey }));
    const newCiphertext = encryptSensitiveValue("13800138000");

    expect(oldCiphertext).toMatch(/^v2\.old-key\./);
    expect(newCiphertext).toMatch(/^v2\.new-key\./);
    expect(decryptSensitiveValue(oldCiphertext)).toBe("13800138000");
    expect(decryptSensitiveValue(newCiphertext)).toBe("13800138000");
  });
  it("produces deterministic HMAC-SHA-256 output", () => {
    const value = "13800138000";

    expect(hashSensitiveValue(value)).toBe(hashSensitiveValue(value));
    expect(hashSensitiveValue(value)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSensitiveValue("13800138001")).not.toBe(hashSensitiveValue(value));
  });

  it("masks national IDs and phone numbers", () => {
    expect(maskNationalId("11010519491231002X")).toBe("**************002X");
    expect(maskPhone("13800138000")).toBe("138****8000");
  });

  it.each(["", "1", "1234", "12345678901234567", "1234567890123456789"])(
    "does not expose an empty, short, or abnormal national ID: %j",
    (value) => {
      const masked = maskNationalId(value);

      expect(masked).toBe("******************");
      expect(masked).not.toContain(value || "not-applicable");
    },
  );

  it.each(["", "1", "1234567", "1234567890", "123456789012"])(
    "does not expose an empty, short, or abnormal phone number: %j",
    (value) => {
      const masked = maskPhone(value);

      expect(masked).toBe("***********");
      expect(masked).not.toContain(value || "not-applicable");
    },
  );
});
