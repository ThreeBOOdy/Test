# 01 — 教师设置学生 activeLevel（API + 教师学生管理页）

**What to build:** 教师可以在学生管理页为单个学生设置/修改可空的 activeLevelId（A/B/C/未分配），后端持久化并写入审计日志；这是学生端访问控制的基础。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 教师学生管理页显示每个学生当前 activeLevel，并提供 A/B/C/未分配 下拉选择
- [ ] 保存后后端更新 User.activeLevelId，且校验字母类存在并启用
- [ ] 修改 activeLevel 时写入审计日志
- [ ] 相关 API 与 UI 测试通过
