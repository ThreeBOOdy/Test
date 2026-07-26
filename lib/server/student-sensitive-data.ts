import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { getStudentDataSecrets } from "@/lib/server/env";

const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const NATIONAL_ID_LENGTH = 18;
const PHONE_LENGTH = 11;
const MASKED_NATIONAL_ID = "*".repeat(NATIONAL_ID_LENGTH);
const MASKED_PHONE = "*".repeat(PHONE_LENGTH);

export function encryptSensitiveValue(value: string) {
  const { encryptionKey } = getStudentDataSecrets();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(Buffer.from(VERSION));

  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
  return `${VERSION}.${payload.toString("base64url")}`;
}

export function decryptSensitiveValue(value: string) {
  const [version, encodedPayload, extra] = value.split(".");
  if (version !== VERSION || !encodedPayload || extra !== undefined) throw new Error("Unsupported sensitive value format");

  const payload = Buffer.from(encodedPayload, "base64url");
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) throw new Error("Sensitive value authentication failed");

  const iv = payload.subarray(0, IV_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, -AUTH_TAG_LENGTH);
  const authTag = payload.subarray(-AUTH_TAG_LENGTH);

  try {
    const { encryptionKey } = getStudentDataSecrets();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAAD(Buffer.from(VERSION));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Sensitive value authentication failed");
  }
}

export function hashSensitiveValue(value: string) {
  const { hashKey } = getStudentDataSecrets();
  return createHmac("sha256", hashKey).update(value, "utf8").digest("base64url");
}

export function maskNationalId(value: string) {
  if (value.length !== NATIONAL_ID_LENGTH) return MASKED_NATIONAL_ID;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export function maskPhone(value: string) {
  if (value.length !== PHONE_LENGTH) return MASKED_PHONE;
  return `${value.slice(0, 3)}${"*".repeat(Math.max(0, value.length - 7))}${value.slice(-4)}`;
}
