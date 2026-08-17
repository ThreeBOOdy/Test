# 02 — Prisma 数据模型：解析字段 + AI 用量日志

**What to build:** 为题库补充 AI 解析字段，并新增 AI 调用用量日志表，为后续解析生成、答疑、复习规划提供数据基础。

**Blocked by:** 01（可选，可并行）

**Status:** done

- [ ] 在 `Question` 上新增：
  - `explanation String?`
  - `explanationStatus String @default("NONE")`（建议 `NONE` / `DRAFT` / `APPROVED` / `REJECTED`）
  - `explanationVersion Int @default(0)`
  - `explanationReviewedById String?`
  - `explanationReviewedAt DateTime?`
- [ ] 新增 `AiUsageLog` 模型：
  - `id`
  - `userId?`
  - `action`（如 `EXPLANATION_GENERATE`、`CHAT`、`REPORT`）
  - `provider`
  - `model`
  - `promptTokens`
  - `completionTokens`
  - `totalTokens`
  - `latencyMs`
  - `requestHash`
  - `createdAt`
- [ ] 生成并提交 Prisma migration。
- [ ] 补充 schema / migration 测试，确保新字段可读写。
- [ ] 确保旧数据兼容：`explanationStatus` 默认 `NONE`，已有题目不受影响。

**验收标准：**
- 全新数据库迁移成功。
- `Question` 可以保存 AI 解析和审核状态。
- `AiUsageLog` 可以记录一次 AI 调用。
