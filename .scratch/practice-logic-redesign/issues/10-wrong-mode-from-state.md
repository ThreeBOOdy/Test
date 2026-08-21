# 10 — 错题模式从状态派生 + FSRS 排序

**What to build:** 错题列表改为从 StudentLevelQuestionState 派生；错题模式包含当前字母类全部未掌握错题，按 FSRS 到期/低掌握排序，不设上限。

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] 错题列表数据源切换为 StudentLevelQuestionState
- [ ] 错题模式包含 wrongCount>0 且未掌握的全部题目
- [ ] 排序为 favorite 优先 → dueAt 升序 → wrongCount 降序 → ignored 靠后
- [ ] 相关测试通过
