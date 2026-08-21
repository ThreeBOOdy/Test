# 做题逻辑重构 23 分片完成对照表

> 最终完成证据。当前分支：`codex/unified-practice-and-multisheet-import`
> 最近提交：`e1dfa34 test(issue-26): unblock and pass full E2E on Windows/CI`

## 全量验收结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npx tsc --noEmit` | ✅ 通过 | 无类型错误 |
| `npm run lint` | ✅ 通过 | 0 errors |
| `npm test` | ✅ 通过 | 此前全量 140 文件 / 919 用例通过 |
| `npm run test:integration` | ✅ 通过 | 此前全量 13 文件 / 96 用例通过 |
| `npm run test:e2e` | ✅ 通过 | **13/13 passed（5.2m）**，隔离库 `practice_ci_e2e` |
| `npm run build` | ✅ 通过 | Next.js production build 成功 |

---

## 分片 → 实现 commit → 测试/验收结果

| 分片 | 标题 | 实现 commit | 核心测试/证据 |
| --- | --- | --- | --- |
| 01 | 教师设置学生 activeLevel（API + 教师页 + 审计） | `b9d4a8e` | `tests/student-active-level-access.test.ts`、`tests/student-page-access-guards.test.ts`；E2E 教师绑定链路 |
| 02 | 学生端按 activeLevel 过滤与未分配拦截 | `2e645d6` | `tests/student-active-level-access.test.ts`、`tests/student-home-practice-modes.test.ts`；E2E 未分配提示/五入口收敛 |
| 03 | StudentLevelQuestionState 数据模型 + FSRS 领域模块 | `d1cb320` | `tests/learning-state.test.ts`、`tests/mysql-migration.test.ts`；Prisma validate 通过 |
| 04 | 练习作答写入学习状态 | `4a2fa4e` | `tests/student-question-state-route.test.ts`、`tests/student-question-state-service.test.ts`、`tests/integration/production-foundation.test.ts` |
| 05 | 学生端掌握概览 | `382700f` | `tests/mastery-overview.test.ts`、`tests/student-mastery-overview-route.test.ts`、`tests/student-mastery-overview-service.test.ts`、`tests/student-mastery-overview.test.tsx` |
| 06 | 顺序刷题全量题号 + lastIndex 续做 + 轮次计数 | `cb19f69` | `tests/student-practice-start-sequential.test.ts`；E2E 顺序刷题断点续做 |
| 07 | 顺序刷题学习/练习模式切换 | `90719f0` | `tests/practice-session-mode-route.test.ts`、`tests/practice-runner.test.tsx`；E2E 模式开关 |
| 08 | 随机刷题未做优先（不限题量） | `78167d8` | `tests/practice-engine.test.ts`、`tests/practice-sessions-route.test.ts`；E2E 随机刷题 |
| 09 | 随机刷题到期复习 + 低掌握补强 + 阶段性完成 | `a17f69a` | `tests/practice-engine.test.ts`、`tests/review-plan-engine.test.ts`；E2E 随机会话 |
| 10 | 错题模式从状态派生 + FSRS 排序 | `7b9dce0` | `tests/wrong-question-mastery.test.ts`；E2E 错题模式 |
| 11 | 错题一键清除（权限 + 审计） | `89817d6` | `tests/wrong-question-clear-route.test.ts`、`tests/wrong-question-clear-service.test.ts`、`tests/wrong-clear-button.test.tsx`、`tests/integration/wrong-question-clear.integration.test.ts`；E2E 错题清除 |
| 12 | 收藏/忽略切换 API | `0981b23` | `tests/student-question-state-route.test.ts`、`tests/student-question-state-service.test.ts` |
| 13 | 练习界面收藏/忽略按钮 | `9eadf71` | `tests/practice-runner.test.tsx`、`tests/practice-ui.test.ts`；E2E 收藏按钮 |
| 14 | 收藏列表页 + 练习收藏题 | `19e5a4a` | `tests/favorites-page.test.ts`、`tests/practice-favorite-session.test.ts`；E2E 收藏列表 |
| 15 | ExamBlueprint/Item 数据模型 + 默认蓝图迁移 | `bca84f2` | `tests/exam-blueprints.test.ts`、`tests/mysql-migration.test.ts`；新迁移已在 MySQL 8 全量应用成功 |
| 16 | 教师蓝图管理 CRUD API | `933c0cc` | `tests/exam-blueprint-api.test.ts`、`tests/exam-blueprint-service-crud.test.ts`、`tests/exam-blueprint-service.test.ts` |
| 17 | 教师蓝图管理 UI | `02e99ed` | `tests/exam-blueprint-manager.test.tsx`；E2E 蓝图配置 |
| 18 | 模拟测试按蓝图抽题与创建会话 | `394ed07` | `tests/exam-blueprints.test.ts`、`tests/practice-sessions-route.test.ts`；E2E 模拟考试 |
| 19 | 模拟测试交卷写入 FSRS | 共用写入：`4a2fa4e`；专项覆盖：`5acfe40` | `tests/student-question-state-route.test.ts`、`tests/integration/production-foundation.test.ts` |
| 20 | 学生端模拟测试入口与蓝图选择 | `3623fbe` | `tests/student-mock-blueprint-entry.test.ts`；E2E 模拟考试入口 |
| 21 | 学生端入口收敛为五模式 | `29e0878` | `tests/student-home-practice-modes.test.ts`、`tests/student-page-access-guards.test.ts`；E2E 五模式入口 |
| 22 | 今日复习改用 FSRS 生成 | `6e0f63e` | `tests/review-plan-engine.test.ts`、`tests/review-plan-routes.test.ts`；E2E 今日复习/错题巩固 |
| 23 | 端到端验收与回归 | `a1d4106`（补 E2E 覆盖）+ `e1dfa34`（解阻并跑通） | `tests/e2e/*.spec.ts`：**13 passed（5.2m）**；验收报告 `docs/operations/issue-26-e2e-acceptance-report.md` |

---

## 说明

- 每个分片均有对应 feature/test commit 合入当前分支；GitHub issue 编号对应关系见提交历史（#6–#26）。
- `23` 号分片已从“环境阻塞（WSL 缺 `libnspr4.so`）”变为真实通过：在已安装 Playwright 系统依赖的 Windows 主机 + MySQL 8.0.46 隔离库 `practice_ci_e2e` 上执行 `npm run test:e2e`，13/13 通过。
- 过程中同时修复了 `20260821020000_exam_blueprint_models` 迁移在 MySQL 8 上的临时表兼容问题。
