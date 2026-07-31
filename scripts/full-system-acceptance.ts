import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(__dirname, "..");
const reportPath = path.resolve(projectRoot, process.env.ACCEPTANCE_REPORT_FILE ?? "docs/operations/full-system-acceptance-report.md");
const startedAt = new Date();

type Status = "passed" | "failed" | "blocked";
type Result = { name: string; command: string; status: Status; exitCode: number | null; durationMs: number; output: string; reason?: string };

function executable(command: string) {
  return process.platform === "win32" && ["npm", "npx"].includes(command) ? `${command}.cmd` : command;
}

function spawnCommand(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };
  return { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", [executable(command), ...args].join(" ")] };
}

function redact(output: string) {
  return output.replaceAll(/(?:https?:\/\/[^\s]+|(?:PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL)=[^\s]+)/gi, "[redacted]").slice(-4000).trim();
}

function run(name: string, command: string, args: string[], environment: Record<string, string | undefined> = {}): Result {
  const started = Date.now();
  const child = spawnCommand(command, args);
  const processResult = spawnSync(child.command, child.args, { cwd: projectRoot, env: { ...process.env, ...environment }, encoding: "utf8", shell: false, timeout: 20 * 60 * 1000 });
  const output = redact(`${processResult.stdout ?? ""}${processResult.stderr ?? ""}`);
  const errorCode = (processResult.error as NodeJS.ErrnoException | undefined)?.code;
  const status: Status = errorCode === "ETIMEDOUT" ? "blocked" : processResult.status === 0 ? "passed" : "failed";
  return { name, command: [command, ...args].join(" "), status, exitCode: processResult.status, durationMs: Date.now() - started, output, ...(processResult.error ? { reason: processResult.error.message } : {}) };
}

function resultForBlocked(name: string, command: string, reason: string): Result {
  return { name, command, status: "blocked", exitCode: null, durationMs: 0, output: "", reason };
}

function databaseName(value: string | undefined) {
  if (!value) return undefined;
  try { return new URL(value).pathname.replace(/^\/+/, ""); } catch { return undefined; }
}

function isAllowedDatabase(value: string | undefined, allowed: string[]) {
  const name = databaseName(value);
  return name !== undefined && allowed.includes(name);
}

function canReachDatabase(value: string | undefined) {
  if (!value) return Promise.resolve({ ok: false, reason: "未提供数据库连接地址" });
  try {
    const url = new URL(value);
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 3306) });
    return new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      const finish = (ok: boolean, reason?: string) => { socket.destroy(); resolve({ ok, reason }); };
      socket.once("connect", () => finish(true));
      socket.once("error", (error) => finish(false, error.message));
      socket.setTimeout(3000, () => finish(false, "连接超时"));
    });
  } catch (error) {
    return Promise.resolve({ ok: false, reason: error instanceof Error ? error.message : "数据库连接地址无效" });
  }
}

function evidence(results: Result[]) {
  const unit = results.find((result) => result.name === "领域/API/UI 测试")?.status;
  const integration = results.find((result) => result.name === "MySQL 集成测试")?.status;
  const e2e = results.find((result) => result.name === "Playwright 端到端测试")?.status;
  const restore = results.find((result) => result.name === "隔离恢复演练")?.status;
  return [
    ["28.1 权限验收", unit === "passed" ? "verified" : unit === "blocked" ? "blocked" : "partial", "tests/role-route-access.test.ts；tests/registration-review-access.test.ts；tests/student-sensitive-data-route.test.ts；tests/course-boundary.test.ts", unit === "passed" ? "" : "领域/API 回归未全通过，不能宣称权限验收完成。"],
    ["28.2 一致性验收", unit === "blocked" ? "blocked" : "partial", "tests/registration-review-route.test.ts；tests/question-concurrency-routes.test.ts；tests/practice-engine.test.ts；tests/practice-draft-route.test.ts", "审计故障回滚、并发建练习和所有幂等请求未被统一验收场景完整覆盖。"],
    ["28.3 考试验收", e2e === "blocked" ? "blocked" : "partial", "tests/exam-rules.test.ts；tests/practice-draft-route.test.ts；scripts/exam-settlement-worker.ts；tests/e2e/production-flows.spec.ts", "关闭浏览器、worker 重启补交、延迟泄题和未作答组合仍需专门验收。"],
    ["28.4 安全验收", unit === "blocked" ? "blocked" : "partial", "tests/backup-operations.test.ts；tests/student-sensitive-data.test.ts；tests/session-guards.test.ts；docs/operations/lan-https-acceptance.md", "生产数据库、备份、日志和受管设备证书需在目标环境检查；脚本不会打印密钥。"],
    ["28.5 数据与恢复验收", restore === "passed" && integration === "passed" ? "verified" : restore === "blocked" || integration === "blocked" ? "blocked" : "partial", "tests/data-retention.test.ts；tests/integration/data-retention.integration.test.ts；tests/backup-operations.test.ts；scripts/backup-cli.ts；scripts/restore-drill-core.ts", restore === "blocked" ? "未提供隔离恢复目标和密钥，未执行破坏性恢复操作。" : "恢复或集成证据不完整。"],
  ];
}

async function main() {
  const results: Result[] = [];
  const databaseUrl = process.env.ACCEPTANCE_DATABASE_URL;
  const migrationUrl = process.env.ACCEPTANCE_MIGRATION_DATABASE_URL;
  const e2eUrl = process.env.ACCEPTANCE_E2E_DATABASE_URL;
  const isolated = isAllowedDatabase(databaseUrl, ["practice_ci_integration", "practice_acceptance_integration"]) && isAllowedDatabase(migrationUrl, ["practice_ci_migration", "practice_acceptance_migration"]) && isAllowedDatabase(e2eUrl, ["practice_ci_e2e", "practice_acceptance_e2e"]);

  results.push(run("Prisma schema validation", "npx", ["prisma", "validate"]));
  results.push(run("Lint", "npm", ["run", "lint"]));
  results.push(run("领域/API/UI 测试", "npm", ["test", "--", "--reporter=dot"]));

  if (!databaseUrl || !migrationUrl || !e2eUrl || !isolated) {
    results.push(resultForBlocked("MySQL 集成测试", "npm run test:integration", "必须提供三套显式隔离数据库：practice_ci_integration/practice_acceptance_integration、practice_ci_migration/practice_acceptance_migration、practice_ci_e2e/practice_acceptance_e2e。"));
    results.push(resultForBlocked("Playwright 端到端测试", "npm run test:e2e", "缺少显式隔离的 E2E 数据库连接地址。"));
  } else {
    const reachable = await Promise.all([databaseUrl, migrationUrl, e2eUrl].map(canReachDatabase));
    if (reachable.some((item) => !item.ok)) {
      const reason = reachable.map((item, index) => item.ok ? `${index + 1}:ok` : `${index + 1}:${item.reason}`).join("；");
      results.push(resultForBlocked("MySQL 集成测试", "npm run test:integration", `数据库环境不可达：${reason}`));
      results.push(resultForBlocked("Playwright 端到端测试", "npm run test:e2e", `数据库环境不可达：${reason}`));
    } else {
      results.push(run("集成库迁移", "npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: databaseUrl }));
      results.push(run("E2E 库迁移", "npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: e2eUrl }));
      results.push(run("E2E 库种子", "npm", ["run", "db:seed"], { DATABASE_URL: e2eUrl }));
      results.push(run("MySQL 集成测试", "npm", ["run", "test:integration"], { DATABASE_URL: databaseUrl, COURSE_MIGRATION_DATABASE_URL: migrationUrl }));
      results.push(run("Playwright 端到端测试", "npm", ["run", "test:e2e"], { DATABASE_URL: e2eUrl }));
    }
  }

  results.push(run("生产构建与 TypeScript 检查", "npm", ["run", "build"]));
  const restoreKeys = ["BACKUP_ENCRYPTION_KEY", "BACKUP_MANIFEST_AUTH_KEY", "BACKUP_RESTORE_ISOLATED", "BACKUP_RESTORE_ENVIRONMENT", "BACKUP_RESTORE_TARGET_ID", "BACKUP_RESTORE_ISOLATION_ROOT", "BACKUP_RESTORE_COMPOSE_PROJECT", "BACKUP_RESTORE_MANIFEST", "BACKUP_RESTORE_BASE_URL", "BACKUP_RESTORE_SMOKE_USERNAME", "BACKUP_RESTORE_SMOKE_PASSWORD", "STUDENT_DATA_ENCRYPTION_KEY"];
  if (restoreKeys.every((key) => Boolean(process.env[key]))) results.push(run("隔离恢复演练", "npm", ["run", "backup:restore-drill", "--", "--manifest", process.env.BACKUP_RESTORE_MANIFEST!]));
  else results.push(resultForBlocked("隔离恢复演练", "npm run backup:restore-drill", "未提供完整隔离恢复目标、备份清单、敏感数据密钥和 smoke 凭据；未执行破坏性恢复操作。"));

  const completedAt = new Date();
  const rows = results.map((result) => `| ${result.name} | ${result.status} | ${result.durationMs} ms | ${result.reason ?? (result.exitCode === 0 ? "完成" : result.output || "命令失败，无输出")} |`);
  const mapping = evidence(results).map(([section, status, files, gap]) => `| ${section} | ${status} | ${files} | ${gap || "无"} |`);
  const report = ["# 全系统验收报告", "", `- 执行时间：${startedAt.toISOString()} 至 ${completedAt.toISOString()}`, `- 主机：${os.hostname()}`, `- Node：${process.version}`, `- 工作区：${projectRoot}`, "- 规则：仅实际命令成功才记为 passed；缺少环境记为 blocked；场景缺口记为 partial。", "", "## 执行结果", "", "| 检查 | 状态 | 耗时 | 说明 |", "| --- | --- | ---: | --- |", ...rows, "", "## 设计第 28 节映射", "", "| 章节 | 状态 | 证据 | 缺口或环境说明 |", "| --- | --- | --- | --- |", ...mapping, "", "## 重跑步骤", "", "```powershell", "$env:ACCEPTANCE_DATABASE_URL='mysql://.../practice_ci_integration'", "$env:ACCEPTANCE_MIGRATION_DATABASE_URL='mysql://.../practice_ci_migration'", "$env:ACCEPTANCE_E2E_DATABASE_URL='mysql://.../practice_ci_e2e'", "npm.cmd run acceptance", "```", "", "隔离恢复还需设置 `BACKUP_ENCRYPTION_KEY`、`BACKUP_MANIFEST_AUTH_KEY`、`BACKUP_RESTORE_*`、`STUDENT_DATA_ENCRYPTION_KEY` 和 smoke 凭据；脚本不会将这些值写入报告。", "", "## 失败处置", "", "- `failed`：保存命令输出和测试产物，由开发负责人修复后重跑。", "- `blocked`：由环境负责人准备隔离 MySQL、浏览器或恢复目标后重跑；验收入口以非零退出阻止发布。", ""].join("\n");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf8");
  console.log(`Acceptance report written to ${path.relative(projectRoot, reportPath)}`);
  process.exitCode = results.some((result) => result.status !== "passed") ? 1 : 0;
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });