# 03 — AI 解析批量生成 Worker

**What to build:** 新增异步批量任务，为官方题库中缺少解析的题目调用云 API 生成“一句话解析 + 知识点讲解 + 记忆点”，写入 `Question.explanation` 草稿。

**Blocked by:** 01、02

**Status:** completed（Mock 全量已在本地验证：60/60 DRAFT，二次运行 0 生成）

- [x] 新增 `lib/server/ai/explanation.ts`：
  - 构造 prompt：题目、选项、答案、知识点名称、等级。
  - 调用 Provider 生成结构化解析。
  - 解析结果写入 `Question.explanation`，状态设为 `DRAFT`。
- [x] 新增 `scripts/ai-explanation-worker.ts`：
  - 仿 `scripts/exam-settlement-worker.ts` 的 worker 模式。
  - 分批读取 `explanationStatus = NONE` 的题目。
  - 每批调用云 API，失败可重试，记录 `AiUsageLog`。
  - 支持幂等：同一道题不会重复生成。
- [x] 提供手动触发命令，例如 `npm run ai:explain`。
- [x] 支持 MockProvider 下跑通全量生成（本地 MySQL 已跑通）。

**验收标准：**
- 对 1300~1400 道题可分批自动生成解析。
- 生成结果进入 `DRAFT`，不直接对学生可见。
- 中途失败后重新运行不会重复生成同一道题。
- 每次调用都有 `AiUsageLog`。
