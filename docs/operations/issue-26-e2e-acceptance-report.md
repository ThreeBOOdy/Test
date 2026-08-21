# Issue #26 端到端验收与回归报告

- 分支：`issue/26-e2e`
- 执行范围：worktree `/mnt/d/Tests/Test-issue-26`
- 执行日期：2026-08-21
- 结论：单元测试、集成测试、lint、TypeScript、Prisma、build 全部通过；E2E 因浏览器系统依赖缺失（`libnspr4.so`）无法启动，未伪造通过。

## 执行结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npx prisma validate` | ✅ 通过 | schema 有效 |
| `npx prisma generate` | ✅ 通过 | Prisma Client 生成成功 |
| `npm run lint` | ✅ 通过 | 0 errors；3 个既有 warning（`scripts/slice-runner.ts`） |
| `npx tsc --noEmit` | ✅ 通过 | 无类型错误 |
| `npm run test -- --maxWorkers=4` | ✅ 通过 | 140 个文件 / 919 个测试；全量运行中 `import-preview.test.tsx` 1 个用例在负载下超时，单独重跑 7/7 通过 |
| `npm run test:integration` | ✅ 通过 | 13 个文件 / 96 个测试全部通过 |
| `npm run test:e2e` | ⛔ 环境阻塞 | Playwright 无法启动 Chromium：`error while loading shared libraries: libnspr4.so: cannot open shared object file`；已明确记录，不视为通过 |
| `npm run build` | ✅ 通过 | Next.js production build 成功 |

## E2E 阻塞原因

- 当前 WSL 环境缺少 Chromium 运行所需的系统共享库 `libnspr4.so`。
- 尝试执行 `npm run test:e2e` 时，浏览器进程以 `exitCode=127` 启动失败，所有测试均未能进入业务断言。
- 未安装系统依赖（无密码 sudo），因此无法在当前环境安装 `libnspr4`/`libnss3` 后重跑。
- 这是环境问题，不是被测代码失败；已补充/更新的 E2E 用例已通过 `tsc --noEmit` 与 lint。

## 本次 E2E 覆盖调整

在 `tests/e2e/production-flows.spec.ts` 中新增/强化核心用户链路：

1. **教师绑定**：管理员导入并激活学生后，教师将学生绑定到 A 字母类。
2. **蓝图配置**：教师在 A 级下新建一张命名模拟测试蓝图（知识点 `4.1.1`，1 道单选）。
3. **顺序刷题**：原有 A 级顺序练习覆盖断点续做与整轮完成。
4. **今日复习**：顺序练习产生错题后，学生首页出现“今日复习计划”及错题巩固卡片。
5. **错题模式**：原有随机巩固错题闭环覆盖 4 轮错题复习。
6. **错题清除**：制造 1 道错题后通过学生端“一键清除错题”清空。
7. **随机刷题**：进入 A 级随机练习会话。
8. **收藏**：在随机练习中收藏题目，收藏列表出现该题并可发起收藏练习。
9. **模拟测试**：通过教师新建的蓝图进入模拟考试会话。

## 集成测试修复

集成测试清理顺序未覆盖新增模型关联，导致跨测试文件残留触发外键约束：

- 补充删除 `StudentLevelQuestionState`
- 补充删除 `StudentLevelProgress`
- 补充删除 `ExamBlueprintItem`
- 补充删除 `ExamBlueprint`

修复后 `npm run test:integration` 13 文件 / 96 测试全部通过。

## 改动文件清单

- `tests/e2e/production-flows.spec.ts`
- `tests/integration/ai-data-model.integration.test.ts`
- `tests/integration/ai-explanation.integration.test.ts`
- `tests/integration/ai-learning-report.integration.test.ts`
- `tests/integration/data-retention.integration.test.ts`
- `tests/integration/import-batch-image.integration.test.ts`
- `tests/integration/question-image-commit.integration.test.ts`
- `tests/integration/question-image.integration.test.ts`
- `tests/integration/question-import-flexibility.integration.test.ts`
- `tests/integration/student-account-workflows.test.ts`
- `tests/integration/student-import-workflows.test.ts`
- `tests/integration/wrong-question-clear.integration.test.ts`
- `docs/operations/issue-26-e2e-acceptance-report.md`

## 阻塞说明

- E2E 未实际运行通过，唯一阻塞项是浏览器系统依赖缺失。
- 在 CI 或已安装 Playwright 系统依赖的机器上运行 `npm run test:e2e` 可验证新增用例。
