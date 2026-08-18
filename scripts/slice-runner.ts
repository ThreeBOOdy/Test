#!/usr/bin/env node
/**
 * 题库 ABC 灵活化分票顺序执行器（可复用工具）
 *
 * 用途：
 * - 为 S1..S11 每个分票生成“独立对话”的开场提示词；
 * - 维护每个分票的完成状态与 commit；
 * - 按依赖/顺序给出下一个可执行分票；
 * - 校验某个分票是否通过基础质量门禁（tsc / prisma validate / eslint）。
 *
 * 状态文件：.jspace/slice-runner.json
 *
 * 用法：
 *   npm run slice:status
 *   npm run slice:next
 *   npm run slice:prompt -- S4
 *   npm run slice:mark -- S2 <commit-hash>
 *   npm run slice:verify -- S2 [commit-hash]
 *   npm run slice:reset -- S2
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STATE_PATH = join(ROOT, ".jspace", "slice-runner.json");

type SliceDef = {
  id: string;
  title: string;
  summary: string;
  acceptance: string;
  deps: string[];
  prisma: boolean;
};

const SLICES: SliceDef[] = [
  {
    id: "S1",
    title: "数据模型与迁移",
    summary:
      "新增 KnowledgePointType、QuestionLevel；KnowledgePoint.typeId；Question.externalQuestionCode 全局唯一；回填/查重脚本。",
    acceptance: "prisma validate 通过；迁移可执行；冲突预检脚本输出清单。",
    deps: [],
    prisma: true,
  },
  {
    id: "S2",
    title: "字母类维护",
    summary: "Level 维护 API/UI：新增/编辑/停用，支持 A/B/C/K 等。",
    acceptance: "可创建 K 类并出现在列表；停用后不在向导/练习出现。",
    deps: ["S1"],
    prisma: false,
  },
  {
    id: "S3",
    title: "知识点类型维护",
    summary: "KnowledgePointType CRUD + 知识点树维护（大类/小类动态增删改）。",
    acceptance: "可创建类型、在类型下建树、停用类型。",
    deps: ["S1"],
    prisma: true,
  },
  {
    id: "S4",
    title: "知识点服务升级",
    summary: "ensureKnowledgePoint 支持 typeId、动态插入、放开分类号格式。",
    acceptance: "单测覆盖父节点复用、部分子树插入、非数字分类号。",
    deps: ["S1", "S3"],
    prisma: false,
  },
  {
    id: "S5",
    title: "领域类型与重复检测",
    summary: "Question.levelIds；导入去掉字母类；去重身份键全局；移除默认 A。",
    acceptance: "单测覆盖全局重复、无字母类导入、动态类别。",
    deps: ["S1"],
    prisma: false,
  },
  {
    id: "S6",
    title: "导入解析与提交",
    summary:
      "多 sheet 以 sheet 名建类型；单 sheet/Word 接收向导类型参数；提交只写题目+知识点，不写字母类；commit 返回 questionIds。",
    acceptance: "集成测试：多 sheet 类型、单 sheet 向导、导入后未归类。",
    deps: ["S1", "S4", "S5"],
    prisma: false,
  },
  {
    id: "S7",
    title: "归类 API",
    summary: "拉取/取消/批量 QuestionLevel，审计。",
    acceptance: "API 测试：多类、批量、未归类。",
    deps: ["S1", "S5"],
    prisma: false,
  },
  {
    id: "S8",
    title: "题目编辑 API/UI",
    summary: "字母类多选、知识点按类型树选择。",
    acceptance: "组件/API 测试通过。",
    deps: ["S1", "S3", "S5", "S7"],
    prisma: false,
  },
  {
    id: "S9",
    title: "导入向导 UI",
    summary: "多 sheet 自动识别、单 sheet 问大类+小类、提交后字母类归类向导。",
    acceptance: "组件/E2E 测试通过。",
    deps: ["S2", "S3", "S6", "S7", "S8"],
    prisma: false,
  },
  {
    id: "S10",
    title: "练习抽题与快照",
    summary: "按 QuestionLevel 过滤；启动器动态取字母类；快照注入当前字母类；规则不写死深度。",
    acceptance: "集成测试：K 类可抽题；旧会话回归通过。",
    deps: ["S1", "S5"],
    prisma: false,
  },
  {
    id: "S11",
    title: "全量回归与文档",
    summary: "更新 README/CONTEXT/领域文档；完整单测/lint/build。",
    acceptance: "全量测试通过；文档与实现一致。",
    deps: ["S6", "S7", "S8", "S9", "S10"],
    prisma: false,
  },
];

type SliceStatus = {
  status: "pending" | "in_progress" | "done";
  commit?: string;
  verifiedAt?: string;
  note?: string;
};

type State = {
  slices: Record<string, SliceStatus>;
};

function defaultState(): State {
  const slices: Record<string, SliceStatus> = {};
  for (const s of SLICES) slices[s.id] = { status: "pending" };
  return { slices };
}

function loadState(): State {
  if (!existsSync(STATE_PATH)) return defaultState();
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<State>;
    const state = defaultState();
    for (const s of SLICES) {
      const existing = raw.slices?.[s.id];
      if (existing) state.slices[s.id] = { ...state.slices[s.id], ...existing };
    }
    return state;
  } catch {
    return defaultState();
  }
}

function saveState(state: State) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function getSlice(id: string): SliceDef {
  const slice = SLICES.find((s) => s.id.toLowerCase() === id.toLowerCase());
  if (!slice) {
    console.error(`未知分票：${id}。可用：${SLICES.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  return slice;
}

function gitCommitExists(commit: string): boolean {
  try {
    execSync(`git rev-parse --verify --quiet ${commit}`, { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function gitHead(): string {
  return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
}

function isUnblocked(slice: SliceDef, state: State): boolean {
  return slice.deps.every((dep) => state.slices[dep]?.status === "done");
}

function nextSlice(state: State): SliceDef | null {
  for (const s of SLICES) {
    const st = state.slices[s.id];
    if (st.status !== "done" && isUnblocked(s, state)) return s;
  }
  return null;
}

function promptFor(slice: SliceDef): string {
  const depsLine =
    slice.deps.length > 0 ? `依赖：${slice.deps.join("、")}（应已完成并提交）。` : "依赖：无（首个分票）。";
  return [
    `使用 J-space 技能；项目地址：/mnt/d/Tests/Test；分票地址：docs/question-bank-abc-flexibility-slices.md#${slice.id}`,
    ``,
    `请实现分票 ${slice.id}：${slice.title}。`,
    ``,
    `分票内容：${slice.summary}`,
    `验收标准：${slice.acceptance}`,
    depsLine,
    ``,
    `要求：`,
    `1. 先完整阅读 docs/question-bank-abc-flexibility-spec.md 与 docs/question-bank-abc-flexibility-slices.md。`,
    `2. 只做 ${slice.id} 范围内的改动；不要夹带其它分票或无关重构。`,
    `3. 完成定义：通过 npx tsc --noEmit、npm run lint、相关 vitest；涉及 Prisma 的通过 npx prisma validate。`,
    `4. 全部通过后，用 git add -A 提交（提交信息含 ${slice.id}），例如：feat(question-bank): ${slice.id} ${slice.title}。`,
    `5. 提交后运行：npm run slice:mark -- ${slice.id} <commit-hash>` +
      (slice.id === "S1" ? `（若 S1 已随 baseline 完成，可 mark 到 baseline commit）` : ``) +
      `，并返回 JSON：{"commitHash":"...","summary":"..."}`,
  ].join("\n");
}

function printStatus(state: State) {
  console.log("题库 ABC 灵活化分票状态\n");
  for (const s of SLICES) {
    const st = state.slices[s.id];
    const depOk = s.deps.every((d) => state.slices[d]?.status === "done");
    const depBad = s.deps.filter((d) => state.slices[d]?.status !== "done");
    const depText = depBad.length === 0 ? "" : ` [阻塞: ${depBad.join(",")}]`;
    const commitText = st.commit ? ` @${st.commit.slice(0, 8)}` : "";
    const statusText = st.status === "done" ? "✅ done" : st.status === "in_progress" ? "🔄 in_progress" : "⬜ pending";
    console.log(`${s.id.padEnd(3)} ${statusText.padEnd(14)} ${s.title}${commitText}${depText}`);
  }
  const next = nextSlice(state);
  console.log(`\n下一个可执行分票：${next ? next.id + " " + next.title : "（全部完成）"}`);
  if (next) {
    console.log(`\n可用以下命令生成独立对话开场：`);
    console.log(`  npm run slice:prompt -- ${next.id}`);
  }
}

function printPrompt(id: string) {
  const slice = getSlice(id);
  console.log(promptFor(slice));
}

function markDone(id: string, commit: string | undefined) {
  const slice = getSlice(id);
  if (!commit) {
    console.error(`请提供 commit hash：npm run slice:mark -- ${id} <commit-hash>`);
    process.exit(1);
  }
  if (!gitCommitExists(commit)) {
    console.error(`commit 不存在：${commit}`);
    process.exit(1);
  }
  const state = loadState();
  state.slices[id] = { status: "done", commit, verifiedAt: new Date().toISOString() };
  saveState(state);
  console.log(`已标记 ${id} 完成 @ ${commit}`);
  const next = nextSlice(state);
  if (next) console.log(`下一个可执行分票：${next.id} ${next.title}`);
  else console.log("全部分票已完成 🎉");
}

function resetSlice(id: string) {
  const slice = getSlice(id);
  const state = loadState();
  state.slices[id] = { status: "pending" };
  saveState(state);
  console.log(`已重置 ${slice.id} 为 pending`);
}

function runVerify(id: string, commit: string | undefined, full: boolean) {
  const slice = getSlice(id);
  const state = loadState();
  const recorded = state.slices[id]?.commit;
  const target = commit ?? recorded;
  if (!target) {
    console.error(`没有可校验的 commit，请提供：npm run slice:verify -- ${id} <commit-hash>`);
    process.exit(1);
  }
  if (!gitCommitExists(target)) {
    console.error(`commit 不存在：${target}`);
    process.exit(1);
  }
  console.log(`校验 ${id}（commit ${target}）${full ? "完整" : "基础"}质量门禁...\n`);

  const run = (label: string, cmd: string) => {
    console.log(`▶ ${label}`);
    try {
      execSync(`timeout 240 ${cmd}`, { cwd: ROOT, stdio: "inherit" });
      console.log(`✔ ${label} 通过\n`);
    } catch {
      console.error(`✘ ${label} 失败`);
      process.exit(1);
    }
  };

  run("tsc --noEmit", "npx tsc --noEmit");
  run("prisma validate", "npx prisma validate");
  if (full) run("eslint", "npm run lint");

  console.log(
    `${id} ${full ? "完整" : "基础"}门禁通过。相关单测/集成测试请按分票验收标准单独运行。` +
      (full ? "" : "（如需 eslint，请加 --full）"),
  );
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "status":
      printStatus(loadState());
      break;
    case "next":
      const next = nextSlice(loadState());
      if (!next) {
        console.log("全部分票已完成 🎉");
        break;
      }
      console.log(next.id);
      console.log(next.title);
      console.log(promptFor(next));
      break;
    case "prompt":
      if (!args[0]) {
        console.error("用法：npm run slice:prompt -- S4");
        process.exit(1);
      }
      printPrompt(args[0]);
      break;
    case "mark":
      markDone(args[0], args[1]);
      break;
    case "reset":
      resetSlice(args[0]);
      break;
    case "verify":
      runVerify(args[0], args[1], args.includes("--full"));
      break;
    case "head":
      console.log(gitHead());
      break;
    default:
      console.log(`用法：
  npm run slice:status
  npm run slice:next
  npm run slice:prompt -- S4
  npm run slice:mark -- S2 <commit-hash>
  npm run slice:reset -- S2
  npm run slice:verify -- S2 [commit-hash] [--full]
  npm run slice:head
`);
      process.exit(cmd ? 1 : 0);
  }
}

main();
