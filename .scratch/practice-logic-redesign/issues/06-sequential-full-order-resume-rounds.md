# 06 — 顺序刷题全量题号 + lastIndex 续做 + 轮次计数

**What to build:** 顺序刷题改为当前字母类全部 ACTIVE 题目按题号递增，不再读题量规则；支持上次位置续做；完整刷完一轮后轮次计数 X 加一并展示。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] 顺序会话包含当前字母类全部题目，且按题号自然排序
- [ ] lastIndex 持久化，刷新/重新进入可续做
- [ ] 完整刷完一轮后 roundCount 自增并显示“完成 X 轮”
- [ ] 相关测试通过
