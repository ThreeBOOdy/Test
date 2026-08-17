import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(__dirname, "..");
const reportPath = path.resolve(projectRoot, process.env.TICKET12_ACCEPTANCE_REPORT_FILE ?? "docs/operations/ticket12-acceptance-report.md");
const startedAt = new Date();

type Status = "passed" | "failed";
type Result = { name: string; command: string; status: Status; exitCode: number | null; durationMs: number; output: string };

function executable(command: string) {
  return process.platform === "win32" && ["npm", "npx"].includes(command) ? `${command}.cmd` : command;
}

function spawnCommand(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };
  return { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", [executable(command), ...args].join(" ")] };
}

function run(name: string, command: string, args: string[]): Result {
  const started = Date.now();
  const child = spawnCommand(command, args);
  const processResult = spawnSync(child.command, child.args, {
    cwd: projectRoot,
    env: { ...process.env },
    encoding: "utf8",
    shell: false,
    timeout: 20 * 60 * 1000,
  });
  const output = `${processResult.stdout ?? ""}${processResult.stderr ?? ""}`.replace(/\s+$/gm, "").slice(-4000).trim();
  return {
    name,
    command: [command, ...args].join(" "),
    status: processResult.status === 0 ? "passed" : "failed",
    exitCode: processResult.status,
    durationMs: Date.now() - started,
    output,
  };
}

function main() {
  const results: Result[] = [];
  results.push(run("TypeScript 类型检查", "npx", ["tsc", "--noEmit"]));
  results.push(run("ESLint", "npm", ["run", "lint"]));
  results.push(run("12 号票相关单元/组件/路由测试", "npx", [
    "vitest", "run", "--reporter=dot",
    "tests/ai-gamification.test.ts",
    "tests/ai-gamification-route.test.ts",
    "tests/grade-gamification-route.test.ts",
    "tests/grade-gamification-settings.test.tsx",
    "tests/ai-gamification-components.test.tsx",
    "tests/rpg-service.test.ts",
    "tests/rpg-route.test.ts",
    "tests/rpg-panel.test.tsx",
    "tests/mysql-migration.test.ts",
  ]));

  const completedAt = new Date();
  const rows = results.map((result) => `| ${result.name} | ${result.status} | ${result.durationMs} ms | ${result.exitCode === 0 ? "完成" : result.output || "命令失败，无输出"} |`);
  const report = [
    "# 12 号票整合验收报告",
    "",
    `- 执行时间：${startedAt.toISOString()} 至 ${completedAt.toISOString()}`,
    `- 主机：${os.hostname()}`,
    `- Node：${process.version}`,
    `- 工作区：${projectRoot}`,
    "",
    "## 执行结果",
    "",
    "| 检查 | 状态 | 耗时 | 说明 |",
    "| --- | --- | ---: | --- |",
    ...rows,
    "",
    "## 验收范围",
    "",
    "- 班级游戏化开关：教师可对年级隐藏/显示游戏化，学生首页按班级开关隐藏 RPG 面板。",
    "- 学生个人游戏化开关：关闭后不影响刷题主流程。",
    "- AI 今日鼓励：根据今日复习计划生成鼓励语，并记录 AiUsageLog；AI 不可用时降级为固定文案。",
    "- AI 里程碑反馈：升级、任务完成、Boss 通关时生成个性化反馈，并记录 AiUsageLog；AI 不可用时降级。",
    "- 数据库迁移：Grade.gamificationEnabled 与 schema 一致。",
    "",
    "## 重跑步骤",
    "",
    "```powershell",
    "npx tsx scripts/ticket12-acceptance.ts",
    "```",
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf8");
  console.log(`Ticket 12 acceptance report written to ${path.relative(projectRoot, reportPath)}`);
  process.exitCode = results.some((result) => result.status !== "passed") ? 1 : 0;
}

main();
