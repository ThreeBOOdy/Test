import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mariadb from "mariadb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Run via `npm run test:integration` which loads .env.");
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
url.pathname = "/practice_ci_integration";
process.env.DATABASE_URL = url.toString();

async function resetDatabase() {
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectTimeout: 10_000,
  });
  try {
    const rows = await connection.query("SHOW TABLES");
    const tables = rows.map((row) => Object.values(row)[0]).filter(Boolean);
    if (tables.length === 0) return;
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of tables) {
      await connection.query(`DELETE FROM \`${table}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    console.log(`[integration] cleaned ${tables.length} tables in ${url.pathname.slice(1)}`);
  } finally {
    await connection.end();
  }
}

await resetDatabase();

const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts", ...args],
  { cwd: root, stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
