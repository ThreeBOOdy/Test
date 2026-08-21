# 19 — 模拟测试交卷写入 FSRS

**What to build:** 模拟测试交卷后统一判分，并把每道题的结果写入 StudentLevelQuestionState；模拟测试不应用收藏/忽略映射，统一 Good/Again。

**Blocked by:** 18, 04

**Status:** ready-for-agent

- [ ] 交卷后批量更新所有试题状态
- [ ] 答对=Good、答错=Again，不使用收藏/忽略映射
- [ ] 与练习模式共用同一状态表
- [ ] 相关测试通过
