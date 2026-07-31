import "server-only";

export class ServerConfigurationError extends Error {}

function getBase64Key(name: "STUDENT_DATA_ENCRYPTION_KEY" | "STUDENT_DATA_HASH_KEY") {
  const value = process.env[name];
  const error = new ServerConfigurationError(`${name} must be a Base64-encoded 32-byte key`);
  if (!value) throw error;

  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw error;
  return key;
}

function getAdditionalDecryptionKeys() {
  const raw = process.env.STUDENT_DATA_DECRYPTION_KEYS?.trim();
  if (!raw) return new Map<string, Buffer>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ServerConfigurationError("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ServerConfigurationError("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
  }

  const keys = new Map<string, Buffer>();
  for (const [keyId, encoded] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(keyId) || typeof encoded !== "string") {
      throw new ServerConfigurationError("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) {
      throw new ServerConfigurationError("STUDENT_DATA_DECRYPTION_KEYS must be a JSON object of Base64-encoded 32-byte keys");
    }
    keys.set(keyId, key);
  }
  return keys;
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production");
  return "mysql://practice:practice@127.0.0.1:3306/practice_dev";
}

export function assertProductionAuthEnvironment() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") throw new Error("COOKIE_SECURE must be true in production");
  return secret;
}

export function getStudentDataSecrets() {
  const encryptionKey = getBase64Key("STUDENT_DATA_ENCRYPTION_KEY");
  const hashKey = getBase64Key("STUDENT_DATA_HASH_KEY");
  if (encryptionKey.equals(hashKey)) {
    throw new ServerConfigurationError("STUDENT_DATA_ENCRYPTION_KEY and STUDENT_DATA_HASH_KEY must be different");
  }
  return { encryptionKey, hashKey };
}

export function getStudentDataKeyring() {
  const { encryptionKey, hashKey } = getStudentDataSecrets();
  const currentKeyId = process.env.STUDENT_DATA_ENCRYPTION_KEY_ID?.trim() || "default";
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(currentKeyId)) {
    throw new ServerConfigurationError("STUDENT_DATA_ENCRYPTION_KEY_ID must contain only letters, numbers, dots, underscores, or hyphens");
  }
  const decryptionKeys = getAdditionalDecryptionKeys();
  decryptionKeys.set(currentKeyId, encryptionKey);
  return { currentKeyId, currentEncryptionKey: encryptionKey, hashKey, decryptionKeys };
}

export function assertProductionStudentDataEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  getStudentDataKeyring();
}

export function getBusinessTimeZone() {
  return process.env.APP_TIME_ZONE || "Asia/Taipei";
}
