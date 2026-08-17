import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { getStudentDataKeyring } from "@/lib/server/env";

const LEGACY_VERSION = "v1";
const VERSION = "v2";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const NATIONAL_ID_LENGTH = 18;
const PHONE_LENGTH = 11;
const MASKED_NATIONAL_ID = "*".repeat(NATIONAL_ID_LENGTH);
const MASKED_PHONE = "*".repeat(PHONE_LENGTH);

export function encryptSensitiveValue(value: string) {
  const { currentEncryptionKey, currentKeyId } = getStudentDataKeyring();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", currentEncryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(Buffer.from(`${VERSION}.${currentKeyId}`));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
  return `${VERSION}.${currentKeyId}.${payload.toString("base64url")}`;
}

export function decryptSensitiveValue(value: string) {
  const parts = value.split(".");
  const [version, keyId, encodedPayload] = parts;
  const isLegacy = version === LEGACY_VERSION && parts.length === 2;
  const isVersionTwo = version === VERSION && Boolean(keyId) && Boolean(encodedPayload) && parts.length === 3;
  if (!isLegacy && !isVersionTwo) throw new Error("Unsupported sensitive value format");
  const payloadValue = isLegacy ? keyId : encodedPayload;
  if (!payloadValue) throw new Error("Unsupported sensitive value format");

  const payload = Buffer.from(payloadValue, "base64url");
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) throw new Error("Sensitive value authentication failed");
  const iv = payload.subarray(0, IV_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, -AUTH_TAG_LENGTH);
  const authTag = payload.subarray(-AUTH_TAG_LENGTH);
  const { decryptionKeys } = getStudentDataKeyring();
  const candidateKeys = isLegacy ? [...decryptionKeys.values()] : [decryptionKeys.get(keyId!)].filter((key): key is Buffer => Boolean(key));

  for (const key of candidateKeys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAAD(Buffer.from(isLegacy ? LEGACY_VERSION : `${VERSION}.${keyId}`));
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {}
  }
  throw new Error("Sensitive value authentication failed");
}

export function isEncryptedWithCurrentSensitiveKey(value: string) {
  const { currentKeyId } = getStudentDataKeyring();
  return value.startsWith(`${VERSION}.${currentKeyId}.`);
}

export function hashSensitiveValue(value: string) {
  const { hashKey } = getStudentDataKeyring();
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
