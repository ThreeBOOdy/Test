# 02 — 学生端按 activeLevel 过滤与未分配拦截

**What to build:** 学生端只展示被分配的字母类题库；未分配 activeLevel 的学生不能进入任何练习，并看到明确提示；服务端拒绝越权创建会话。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 已分配学生只能看到 activeLevel 对应的练习入口
- [ ] 未分配学生看到“未分配题库，请联系老师”且无法开始练习
- [ ] 创建练习 API 校验 activeLevel 存在且与请求 level 一致
- [ ] 相关测试通过
