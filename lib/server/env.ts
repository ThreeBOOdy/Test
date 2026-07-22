import "server-only";

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production");
  return "postgresql://practice:practice@localhost:5432/practice?schema=public";
}

export function assertProductionAuthEnvironment() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") throw new Error("COOKIE_SECURE must be true in production");
  return secret;
}
