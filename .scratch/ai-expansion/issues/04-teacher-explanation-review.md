# 04 — AI 解析教师审核

**What to build:** 教师可以对 AI 生成的解析草稿进行查看、编辑、通过或驳回，审核后写入正式解析并记录审计。

**Blocked by:** 03

**Status:** done

- [x] 新增教师端 API：
  - 分页查询待审核解析。
  - 查看单题解析详情。
  - 提交审核结果（通过 / 驳回 / 修改后通过）。
- [x] 新增教师端页面或组件：
  - 建议放在 `app/teacher/ai-explanations/page.tsx`。
  - 列表展示题目、知识点、当前解析状态。
  - 详情可编辑解析内容。
- [x] 审核通过时：
  - `explanationStatus = APPROVED`
  - 写入 `QuestionRevision`
  - 写 `AuditLog`
- [x] 驳回时：
  - `explanationStatus = REJECTED`
  - 可填写驳回原因。
- [x] 补充 API 和 UI 测试。

**验收标准：**
- 教师能看到待审核解析列表。
- 教师可编辑并审核通过，学生端之后能看到正式解析。
- 审核动作有审计记录和修订记录。
