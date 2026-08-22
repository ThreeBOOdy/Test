# J-Space Workspace Ledger

## Goal
修复测试账号登录失败问题

## Core
- 字母类可扩展+导入后归类 — Level 动态 A/B/C/K，题目先入公共池
- 知识点类型独立字典+动态插入树 — 多sheet用sheet名，单sheet向导问大类小类，格式不写死
- 导入无类别+全局唯一 — 题目先进公共池，导入后拉取到自定义类题库
- 自定义类别字典 — Level 可扩展，归类向导动态列出，不限 ABC 三类
- externalQuestionCode 全局唯一 — 同一题号只允许一条题目，不再按等级重复导入
- 导入无等级，题目先进公共池 — 归类在导入后通过拉取完成
- QuestionLevel 多等级可见 — 同一道题只存一条记录，A/B/C 练习按关联等级抽题
- 10 XP 规则 — 练习/复习/专注/错题清零自动发放 XP，每日任务进度自动累计
- 10 RPG 数据模型 — PlayerProfile/PlayerLevel/QuestLog/XpLog 与迁移
- 10 API/UI — 玩家状态、今日任务、领取奖励、游戏化开关 + 学生首页 RPG 面板
- 05 学生端解析展示 — 练习/错题页只展示 APPROVED 解析
- 安全边界 — DRAFT/REJECTED 解析永不进入学生端
- 08 报告服务 — lib/server/ai/report.ts 基于 learning-statistics-service 生成学生周报/教师班级报告
- 08 API/UI — student weekly + teacher class 报告接口与卡片，标注 AI 生成，记录 AiUsageLog
- 隐私边界 — 教师报告只喂聚合统计，不包含学生姓名/个人信息
- 复用 01/02 — OpenAI 兼容网关 + AiUsageLog 已就绪，可直接复用

## Verified
- ✓01 已通读路线图并核对现有 schema/services/routes — verified by: 包括 prisma/schema、learning-statistics-service、import-service、word-parser、api routes
- ✓02 已按业务边界重写 AI 路线图 — verified by: including docs/ai-expansion-roadmap.md rewrite, existing schema/services/routes review
- ✓03 已补充服务器出网云API方案、Ollama配置参考、轻度RPG游戏化 — verified by: including docs/ai-expansion-roadmap.md updates and deployment/gamification sections
- ✓04 AI 网关 complete/stream/超时/重试/错误标准化单元测试通过 — verified by: vitest 14 cases including timeout/retry/error/SSE and mock
- ✓05 Question 解析字段与 AiUsageLog 迁移 SQL 已落地并通过 schema/migration 测试 — verified by: prisma validate + mysql-migration.test.ts 18 cases + tsc noEmit
- ✓06 01/02 已应用到本地 MySQL 并通过全部集成测试，已提交 — verified by: prisma migrate deploy + test:integration all 68 cases + git commit 5e0efe4
- ✓07 03 已实现 explanation.ts + ai-explanation-worker.ts + ai:explain + 单测/集成测试文件 — verified by: tsc --noEmit + eslint + vitest 21 cases (ai-provider/explanation)
- ✓08 04 已实现教师审核 API/页面/组件 + 驳回原因字段 + API/UI 测试 — verified by: tsc --noEmit + eslint + vitest 16 cases (ai-explanation-review service/route/manager)
- ✓09 07 已落地 ReviewPlan/ReviewCard 模型与迁移 SQL — verified by: prisma generate + mysql-migration.test.ts 33 cases
- ✓10 07 已实现规则引擎、review-plan-service、学生 API、首页组件与路由测试 — verified by: tsc --noEmit + vitest 33 cases (engine/routes/migration)
- ✓11 05 学生端解析展示已实现：练习提交后/错题本展示 APPROVED 解析，DRAFT/REJECTED 不注入 — verified by: tsc --noEmit + eslint + vitest cases: student-explanation-card 3, practice-runner 11 including all new explanation tests
- ✓12 09 专注模式与连续打卡：FocusSession 模型/迁移 + streak 计算 + API + 学生首页 + 服务层测试 — verified by: prisma validate + tsc --noEmit + eslint + vitest focus-service 18/route 5/migration 22
- ✓13 06 AI 答疑教练已实现：AiConversation/AiMessage + tutor + SSE + 反馈 + 学生端 UI + 测试 — verified by: tsc --noEmit + eslint + vitest 50 cases (ai-tutor/route/chat/mysql-migration/repository-quality)
- ✓14 10 轻度 RPG 基础已实现：PlayerProfile/PlayerLevel/QuestLog/XpLog 模型与迁移、XP 规则接入练习/复习/专注/错题清零、状态/任务/领取/开关 API、学生首页 RPG 面板与开关 — verified by: prisma validate + tsc --noEmit + eslint + vitest 58 cases (rpg service/route/panel + focus regression + mysql-migration)
- ✓15 11 知识点地图/副本/Boss 战已实现：学习地图/掌握状态/待攻克副本入口/Boss血条与结算/隐藏入口开关（mapEnabled） — verified by: prisma validate + tsc --noEmit + eslint + vitest 89 files 534+92 cases
- ✓16 规格文档已写入 docs/question-bank-abc-flexibility-spec.md，含 S1-S7 分片 — verified by: read the spec file; sections cover background/model/duplicates/import/practice/impact/tests/slices
- ✓17 规格文档已修订为‘导入无等级 + 导入后拉取归类’模型，分片扩为 S1-S8 — verified by: read the revised spec; sections cover import/pull/duplicates/practice/impact/tests/slices
- ✓18 规格文档第三版完成：自定义类别字典+导入后归类向导，分片 S1-S9 — verified by: read the v3 spec; sections cover categories/import/wizard/practice/impact/tests/slices
- ✓19 规格文档第四版完成：字母类可扩展+知识点类型字典+动态导入向导，分片 S1-S11 — verified by: read the v4 spec; sections cover letter classes/kp types/import wizard/tree insertion/practice/impact/tests/slices
- ✓20 规格补充 7.5：字母类拉取具体实现方案（commit返回questionIds+批量接口+未归类筛选+省事措施） — verified by: read the updated spec; section 7.5 covers commit response/batch API/UI/convenience
- ✓21 Ticket 01 完成：seed/env/reset/e2e 密码统一 123456 — verified by: lint 0 errors; tsc --noEmit 通过; vitest 731 通过; db:reset-passwords 本地运行成功; e2e 因缺 Chrome/libnspr4 未跑
- ✓22 Ticket 03 完成：首页改为一屏品牌页、已登录按 capability 重定向、静态测试同步更新；已提交 26b1ef6 — verified by: git diff review + lint 0 errors + tsc --noEmit + vitest 113 files/732 tests (含6个超时文件单独重跑通过) + e2e 因缺 Chrome 未跑

## Open
- ?01 当前用户量和题库量是否足够支撑 FSRS/MCP 等后期功能 — settled by: 用现有统计数据或种子数据量估算，再决定是否提前建设

## Next
复现登录失败并检查登录链路/数据库/密码哈希/种子数据
