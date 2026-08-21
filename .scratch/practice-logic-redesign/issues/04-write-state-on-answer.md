# 04 — 练习作答写入学习状态

**What to build:** 练习模式提交答案后，服务端创建/更新 StudentLevelQuestionState，按 FSRS 映射更新状态、错题数、正确数和复习时间；这是随机/错题/收藏/模拟共用的数据写入点。

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] 练习模式提交答案会写入当前 (user, level, question) 状态
- [ ] 答错增加 wrongCount，答对增加 correctCount，FSRS 字段正确更新
- [ ] 收藏/忽略映射按 T03 规则生效
- [ ] 集成测试覆盖首次作答和重复作答
