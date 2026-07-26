import "server-only";

function getBase64Key(name: "STUDENT_DATA_ENCRYPTION_KEY" | "STUDENT_DATA_HASH_KEY") {
  const value = process.env[name];
  const error = new Error(`${name} must be a Base64-encoded 32-byte key`);
  if (!value) throw error;

  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw error;
  return key;
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
    throw new Error("STUDENT_DATA_ENCRYPTION_KEY and STUDENT_DATA_HASH_KEY must be different");
  }

  return { encryptionKey, hashKey };
}

export function assertProductionStudentDataEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  getStudentDataSecrets();
}

export function getBusinessTimeZone() {
  return process.env.APP_TIME_ZONE || "Asia/Taipei";
}
