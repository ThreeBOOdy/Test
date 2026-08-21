# 03 — StudentLevelQuestionState 数据模型 + FSRS 领域模块

**What to build:** 新增统一学习状态表 StudentLevelQuestionState（按 userId + levelId + questionId 唯一），包含 FSRS 字段、收藏/忽略字段、错题统计；提供纯领域状态转换函数与单元测试。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Prisma 模型包含 state/dueAt/stability/difficulty/reps/lapses/intervalDays/lastReviewedAt/favorite/ignored/wrongCount/correctCount/lastResult
- [ ] 唯一约束 (userId, levelId, questionId) 生效
- [ ] FSRS 领域模块支持：答错=Again、答对+收藏=Hard、答对+忽略=Easy、答对普通=Good
- [ ] 纯函数单元测试通过，不依赖数据库
