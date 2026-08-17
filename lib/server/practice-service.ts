import "server-only";
import { ExamSettlementSource, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { parseJsonStringArray } from "@/lib/domain/json-string-array";
import { selectPracticeQuestions, selectPrioritizedRandomQuestions, shuffle, sortQuestionsByBankNumber } from "@/lib/domain/practice-engine";
import { createQuestionSnapshot, gradeQuestionSnapshot, toPublicQuestionSnapshot, type QuestionSnapshot } from "@/lib/domain/practice-snapshot";
import { advanceWrongQuestionMastery } from "@/lib/domain/wrong-question-mastery";
import { completeReviewCardsForSession } from "@/lib/server/review-plan-service";
import { awardPracticeCompletion, awardWrongClearCompletion } from "@/lib/server/rpg-service";
import { parseStudentExplanation, type StudentExplanation } from "@/lib/domain/student-explanation";
import type { ExamRule, PracticeMode, PublicAnswerResult, PublicExamResult, PublicPracticeSession, Question, QuestionOption } from "@/lib/domain/types";

type CreatePracticeRequest =
  | { mode: "level" | "order" | "random" | "exam"; levelCode: string }
  | { mode: "knowledge"; levelCode: string; knowledgePointId: string }
  | { mode: "wrong"; questionId?: string };

type QuestionRecord = {
  id: string;
  levelId: string;
  knowledgePointId: string;
  sourceBankCode: string | null;
  externalQuestionCode: string | null;
  stem: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  optionCount: number;
  correctOptionCount: number;
  selectionSpec: string;
  preserveOptionOrder: boolean;
  options: unknown;
  correctOptionIds: unknown;
  status: "ACTIVE" | "DISABLED" | "ARCHIVED";
  level: { code: string };
  knowledgePoint: { name: string };
};

export async function createPracticeSession(userId: string, input: CreatePracticeRequest): Promise<PublicPracticeSession> {
  if (input.mode === "wrong") return createWrongQuestionSession(userId, input.questionId);
  const level = await prisma.level.findFirst({ where: { code: input.levelCode, enabled: true } });
  if (!level) throw new ApiError("所选等级不存在或已停用", 404);
  if (input.mode === "exam") return createMockExamSession(userId, level.id);

  const mode: PracticeMode = input.mode === "knowledge" ? "KNOWLEDGE_POINT" : input.mode === "order" ? "QUESTION_ORDER" : input.mode === "random" ? "RANDOM_ALL" : "LEVEL_COMPREHENSIVE";
  const point = input.mode === "knowledge" ? await prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, enabled: true } }) : null;
  if (input.mode === "knowledge" && !point) throw new ApiError("所选知识点不存在或已停用", 404);

  const rule = input.mode === "knowledge"
    ? await prisma.knowledgePracticeRule.findUnique({ where: { knowledgePointId_levelId: { knowledgePointId: point!.id, levelId: level.id } } })
    : await prisma.levelPracticeRule.findFirst({ where: { levelId: level.id } });
  if (!rule || !rule.enabled || (rule.singleCount === 0 && rule.multipleCount === 0)) throw new ApiError("教师尚未配置该练习的抽题规则", 409);

  const records = await findQuestionRecords(level.id, point?.id, point?.path);
  const domainQuestions = records.map(toDomainQuestion);
  let selected: Question[];
  if (mode === "QUESTION_ORDER" || mode === "RANDOM_ALL") {
    const answeredIds = await findAnsweredQuestionIds(userId, level.id);
    selected = mode === "QUESTION_ORDER"
      ? selectSequentialQuestions(domainQuestions, rule)
      : selectRandomQuestions(domainQuestions, answeredIds, rule);
  } else {
    selected = selectPracticeQuestions(domainQuestions, { mode, levelId: level.id, knowledgePointIds: point ? [...new Set(domainQuestions.map((question) => question.knowledgePointId))] : undefined, rule }).questions;
  }
  return persistPracticeSession(userId, mode, level.id, point?.id ?? null, createSnapshots(records, selected));
}

async function createMockExamSession(userId: string, levelId: string) {
  const rule = await prisma.examRule.findFirst({ where: { levelId } });
  if (!rule || !rule.enabled) throw new ApiError("教师尚未配置该等级的模拟考试", 409);
  const records = await findQuestionRecords(levelId);
  const questions = selectPracticeQuestions(records.map(toDomainQuestion), { mode: "MOCK_EXAM", levelId, rule }).questions;
  return persistPracticeSession(userId, "MOCK_EXAM", levelId, null, createSnapshots(records, questions), {
    durationMinutes: rule.durationMinutes,
    passingCount: rule.passingCount,
  });
}

async function createWrongQuestionSession(userId: string, questionId?: string): Promise<PublicPracticeSession> {
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { userId, mastered: false, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } },
    include: { question: { include: { level: { select: { code: true } }, knowledgePoint: { select: { name: true } } } } },
  });
  const selected = questionId
    ? wrongQuestions.filter((item) => item.questionId === questionId)
    : shuffle(wrongQuestions).slice(0, 20);
  if (!selected.length) throw new ApiError(questionId ? "该错题不在待巩固列表" : "当前没有待巩固错题", 409);
  const snapshots = selected.map(({ question }) => createQuestionSnapshot({ ...toDomainQuestion(question), levelCode: question.level.code, knowledgeName: question.knowledgePoint.name }));
  return persistPracticeSession(userId, "WRONG_QUESTION", null, null, snapshots);
}

async function persistPracticeSession(userId: string, mode: PracticeMode, levelId: string | null, knowledgePointId: string | null, snapshots: QuestionSnapshot[], examRule?: Pick<ExamRule, "durationMinutes" | "passingCount">): Promise<PublicPracticeSession> {
  const singleCount = snapshots.filter((snapshot) => snapshot.type === "SINGLE_CHOICE").length;
  const multipleCount = snapshots.length - singleCount;
  const startedAt = new Date();
  const expiresAt = examRule ? new Date(startedAt.getTime() + examRule.durationMinutes * 60_000) : null;
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.practiceSession.create({ data: { userId, mode, levelId, knowledgePointId, singleCountSnapshot: singleCount, multipleCountSnapshot: multipleCount, startedAt, expiresAt, durationMinutesSnapshot: examRule?.durationMinutes, passingCountSnapshot: examRule?.passingCount } });
    await tx.practiceSessionQuestion.createMany({ data: snapshots.map((snapshot, position) => ({ sessionId: created.id, questionId: snapshot.questionId, position, snapshot: snapshot as unknown as Prisma.InputJsonValue })) });
    return created;
  });
  return toPublicSession(session, snapshots, {}, examRule && expiresAt ? { ...examRule, expiresAt } : undefined);
}

export async function getPracticeSession(userId: string, sessionId: string): Promise<PublicPracticeSession | null> {
  await settleExpiredMockExamForSession(userId, sessionId);
  const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, userId }, include: { questions: { orderBy: { position: "asc" } }, answers: true, examDraft: true } });
  if (!session) return null;
  const snapshots = session.questions.map((item) => item.snapshot as unknown as QuestionSnapshot);
  const correctCount = session.answers.filter((answer) => answer.isCorrect).length;
  const answeredQuestionIds = session.answers.map((answer) => answer.questionId);
  const explanations = await getApprovedExplanations(answeredQuestionIds);
  const explanationById = new Map(answeredQuestionIds.map((id, index) => [id, explanations[index] ?? null]));
  const results = Object.fromEntries(session.answers.map((answer) => {
    const snapshot = snapshots.find((item) => item.questionId === answer.questionId);
    return [answer.questionId, { isCorrect: answer.isCorrect, correctOptionIds: snapshot?.correctOptionIds ?? [], selectedOptionIds: parseJsonStringArray(answer.selectedOptionIds, "selectedOptionIds"), answeredCount: session.answers.length, correctCount, explanation: explanationById.get(answer.questionId) ?? null }];
  }));
  const exam = session.mode === "MOCK_EXAM" && session.durationMinutesSnapshot && session.passingCountSnapshot && session.expiresAt
    ? { durationMinutes: session.durationMinutesSnapshot, passingCount: session.passingCountSnapshot, expiresAt: session.expiresAt }
    : undefined;
  const draft = session.mode === "MOCK_EXAM" && session.examDraft ? toPublicDraft(session.examDraft.answers, session.examDraft.currentIndex, session.examDraft.version, session.examDraft.updatedAt) : undefined;
  const examResult = session.mode === "MOCK_EXAM" && session.status === "COMPLETED" && session.completedAt
    ? toPublicExamResult(session.correctCount, session.questions.length, session.passingCountSnapshot ?? session.questions.length, session.completedAt, session.examSettlementSource ?? "STUDENT_SUBMISSION")
    : undefined;
  return toPublicSession(session, snapshots, results, exam, draft, examResult);
}

export async function saveExamDraft(userId: string, sessionId: string, input: { answers: Record<string, string[]>; currentIndex: number; version: number }) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.practiceSession.updateMany({ where: { id: sessionId, userId, status: "IN_PROGRESS", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, data: { currentIndex: { increment: 0 } } });
    if (locked.count !== 1) throw new ApiError("模拟考试已经结束", 409);
    const session = await tx.practiceSession.findFirst({ where: { id: sessionId, userId }, include: { questions: true, answers: true, examDraft: true } });
    if (!session) throw new ApiError("模拟考试不存在", 404);
    if (session.mode !== "MOCK_EXAM") throw new ApiError("当前会话不是模拟考试", 409);
    if (session.answers.length) throw new ApiError("模拟考试已经结束", 409);
    if (!Number.isInteger(input.currentIndex) || input.currentIndex < 0 || input.currentIndex >= session.questions.length) throw new ApiError("当前题号无效");
    const questionIds = new Set(session.questions.map((question) => question.questionId));
    for (const [questionId, selectedOptionIds] of Object.entries(input.answers)) {
      const sessionQuestion = session.questions.find((question) => question.questionId === questionId);
      if (!questionIds.has(questionId) || !sessionQuestion) throw new ApiError("草稿中包含无效题目");
      if (!Array.isArray(selectedOptionIds) || selectedOptionIds.some((optionId) => typeof optionId !== "string")) throw new ApiError("草稿答案格式无效");
      validateSelection(sessionQuestion.snapshot as unknown as QuestionSnapshot, selectedOptionIds, true);
    }
    const currentVersion = session.examDraft?.version ?? 0;
    if (input.version !== currentVersion) throw new ApiError("考试草稿版本已更新，请重新加载", 409);
    let saved;
    if (session.examDraft) {
      saved = await tx.examDraft.updateMany({ where: { sessionId, version: input.version }, data: { answers: input.answers as Prisma.InputJsonValue, currentIndex: input.currentIndex, version: { increment: 1 } } });
    } else {
      try { await tx.examDraft.create({ data: { sessionId, answers: input.answers as Prisma.InputJsonValue, currentIndex: input.currentIndex, version: 1 } }); saved = { count: 1 }; } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error; saved = { count: 0 }; }
    }
    if (saved.count !== 1) throw new ApiError("考试草稿版本已更新，请重新加载", 409);
    const draft = await tx.examDraft.findUniqueOrThrow({ where: { sessionId } });
    return toPublicDraft(draft.answers, draft.currentIndex, draft.version, draft.updatedAt);
  });
}
export async function submitPracticeAnswer(userId: string, sessionId: string, questionId: string, selectedOptionIds: string[], idempotencyKey: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize concurrent submissions for the same session by locking the
      // session row first. Without this, two racing inserts both hold shared
      // locks from their foreign-key checks and deadlock against the session
      // update below (InnoDB lock order inversion).
      const sessionLock = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT \`id\` FROM \`PracticeSession\` WHERE \`id\` = ${sessionId} AND \`userId\` = ${userId} FOR UPDATE`);
      if (sessionLock.length !== 1) throw new ApiError("练习不存在或不属于当前学生", 404);
      const sessionQuestion = await tx.practiceSessionQuestion.findUnique({ where: { sessionId_questionId: { sessionId, questionId } }, include: { session: true } });
      if (!sessionQuestion || sessionQuestion.session.userId !== userId) throw new ApiError("题目不属于当前练习", 404);
      if (sessionQuestion.session.mode === "MOCK_EXAM") throw new ApiError("模拟考试请统一交卷", 409);
      const existing = await tx.practiceAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
      const existingKey = await tx.practiceAnswer.findFirst({ where: { sessionId, idempotencyKey } });
      if (existingKey && existingKey.questionId !== questionId) throw new ApiError("答题请求标识已用于其他题目", 409);
      if (existing) return replayOrRejectPracticeAnswer(existing, snapshotFromSessionQuestion(sessionQuestion), selectedOptionIds);
      if (sessionQuestion.session.status !== "IN_PROGRESS") throw new ApiError("练习已经结束", 409);
      const snapshot = sessionQuestion.snapshot as unknown as QuestionSnapshot;
      validateSelection(snapshot, selectedOptionIds, false);
      const isCorrect = gradeQuestionSnapshot(snapshot, selectedOptionIds);
      const answeredBefore = await tx.practiceAnswer.count({ where: { sessionId } });
      const correctBefore = await tx.practiceAnswer.count({ where: { sessionId, isCorrect: true } });
      const answeredCount = answeredBefore + 1;
      const correctCount = correctBefore + Number(isCorrect);
      await tx.practiceAnswer.create({ data: { sessionId, questionId, selectedOptionIds: selectedOptionIds as Prisma.InputJsonValue, idempotencyKey, isCorrect, answeredCountAtSubmission: answeredCount, correctCountAtSubmission: correctCount } });
      if (!isCorrect) await recordWrongQuestionAttempt(tx, userId, questionId, "ANSWERED_WRONG");
      const total = await tx.practiceSessionQuestion.count({ where: { sessionId } });
      const completedAt = answeredCount === total ? new Date() : undefined;
      await tx.practiceSession.update({ where: { id: sessionId }, data: { currentIndex: answeredCount, correctCount, ...(completedAt ? { status: "COMPLETED", completedAt } : {}) } });
      if (completedAt) {
        await settleWrongQuestionMastery(tx, userId, sessionId);
        await completeReviewCardsForSession(userId, sessionId, tx);
        await awardPracticeCompletion(tx, userId, answeredCount, sessionId);
      }
      return { isCorrect, correctOptionIds: snapshot.correctOptionIds, selectedOptionIds, answeredCount, correctCount };
    });
    return { ...result, explanation: await getApprovedExplanation(questionId) };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await prisma.practiceAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
    const sessionQuestion = await prisma.practiceSessionQuestion.findUnique({ where: { sessionId_questionId: { sessionId, questionId } }, include: { session: true } });
    if (!existing || !sessionQuestion || sessionQuestion.session.userId !== userId) throw error;
    const result = replayOrRejectPracticeAnswer(existing, snapshotFromSessionQuestion(sessionQuestion), selectedOptionIds);
    return { ...result, explanation: await getApprovedExplanation(questionId) };
  }
}

export async function submitMockExam(userId: string, sessionId: string, submittedAnswers: { questionId: string; selectedOptionIds: string[] }[]) {
  return settleMockExam(userId, sessionId, submittedAnswers, new Date(), "STUDENT_SUBMISSION");
}

export async function settleExpiredMockExams(now = new Date()) {
  const expired = await prisma.practiceSession.findMany({
    where: { mode: "MOCK_EXAM", status: "IN_PROGRESS", expiresAt: { lte: now } },
    select: { id: true, userId: true },
  });
  const settlements = await Promise.allSettled(expired.map((session) => settleMockExam(session.userId, session.id, undefined, now, "AUTO_SETTLEMENT")));
  return settlements.filter((settlement) => settlement.status === "fulfilled").length;
}

export async function abandonMockExam(userId: string, sessionId: string) {
  const now = new Date();
  const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, userId }, select: { mode: true, status: true, expiresAt: true } });
  if (!session) throw new ApiError("模拟考试不存在", 404);
  if (session.mode !== "MOCK_EXAM") throw new ApiError("当前会话不是模拟考试", 409);
  if (session.status === "COMPLETED") return { abandoned: false, result: await getCompletedExamResult(userId, sessionId) };
  if (session.status === "ABANDONED") return { abandoned: true };
  if (session.expiresAt && session.expiresAt <= now) return { abandoned: false, result: await settleMockExam(userId, sessionId, undefined, now, "AUTO_SETTLEMENT") };

  const abandoned = await prisma.$transaction(async (tx) => {
    const update = await tx.practiceSession.updateMany({ where: { id: sessionId, userId, mode: "MOCK_EXAM", status: "IN_PROGRESS", expiresAt: { gt: now } }, data: { status: "ABANDONED", completedAt: now } });
    if (update.count !== 1) return false;
    await tx.examDraft.deleteMany({ where: { sessionId } });
    return true;
  });
  if (abandoned) return { abandoned: true };
  return { abandoned: false, result: await settleMockExam(userId, sessionId, undefined, now, "AUTO_SETTLEMENT") };
}

async function settleExpiredMockExamForSession(userId: string, sessionId: string) {
  const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, userId, mode: "MOCK_EXAM", status: "IN_PROGRESS", expiresAt: { lte: new Date() } }, select: { id: true } });
  if (session) await settleMockExam(userId, sessionId, undefined, new Date(), "AUTO_SETTLEMENT");
}

async function settleMockExam(userId: string, sessionId: string, submittedAnswers: { questionId: string; selectedOptionIds: string[] }[] | undefined, now: Date, settlementSource: ExamSettlementSource): Promise<PublicExamResult> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.practiceSession.updateMany({ where: { id: sessionId, userId, mode: "MOCK_EXAM", status: "IN_PROGRESS" }, data: { status: "COMPLETED", examSettlementSource: settlementSource } });
    const session = await tx.practiceSession.findFirst({ where: { id: sessionId, userId }, include: { questions: { orderBy: { position: "asc" } }, answers: true, examDraft: true } });
    if (!session) throw new ApiError("模拟考试不存在", 404);
    if (session.mode !== "MOCK_EXAM") throw new ApiError("当前会话不是模拟考试", 409);
    if (claimed.count !== 1) {
      if (session.status === "COMPLETED" && session.completedAt) return toPublicExamResult(session.correctCount, session.questions.length, session.passingCountSnapshot ?? session.questions.length, session.completedAt, session.examSettlementSource ?? "STUDENT_SUBMISSION");
      throw new ApiError("模拟考试已经结束", 409);
    }
    const useDraftAnswers = !submittedAnswers || (session.expiresAt !== null && session.expiresAt <= now);
    const draftAnswers = session.examDraft ? parseExamDraftAnswers(session.examDraft.answers) : {};
    const effectiveAnswers = useDraftAnswers ? Object.entries(draftAnswers).map(([questionId, selectedOptionIds]) => ({ questionId, selectedOptionIds })) : submittedAnswers;
    const answerMap = new Map(effectiveAnswers.map((answer) => [answer.questionId, answer.selectedOptionIds]));
    if (answerMap.size !== effectiveAnswers.length) throw new ApiError("答卷中包含重复题目");
    const sessionQuestionIds = new Set(session.questions.map((item) => item.questionId));
    if (effectiveAnswers.some((answer) => !sessionQuestionIds.has(answer.questionId))) throw new ApiError("答卷中包含无效题目");

    const graded = session.questions.map((item) => {
      const snapshot = item.snapshot as unknown as QuestionSnapshot;
      const selectedOptionIds = answerMap.get(item.questionId) ?? [];
      validateSelection(snapshot, selectedOptionIds, true);
      return { questionId: item.questionId, selectedOptionIds, isCorrect: gradeQuestionSnapshot(snapshot, selectedOptionIds) };
    });
    await tx.practiceAnswer.createMany({ data: graded.map((answer) => ({ sessionId, questionId: answer.questionId, selectedOptionIds: answer.selectedOptionIds as Prisma.InputJsonValue, isCorrect: answer.isCorrect })) });
    const correctCount = graded.filter((answer) => answer.isCorrect).length;
    await tx.practiceSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", currentIndex: graded.length, correctCount, completedAt: now, examSettlementSource: settlementSource } });
    await settleWrongQuestionMastery(tx, userId, sessionId);
    await completeReviewCardsForSession(userId, sessionId, tx);
    await awardPracticeCompletion(tx, userId, graded.length, sessionId);
    await tx.examDraft.deleteMany({ where: { sessionId } });
    return toPublicExamResult(correctCount, graded.length, session.passingCountSnapshot ?? graded.length, now, settlementSource);
  });
}

async function getCompletedExamResult(userId: string, sessionId: string): Promise<PublicExamResult> {
  const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, userId, mode: "MOCK_EXAM", status: "COMPLETED" }, include: { questions: true } });
  if (!session || !session.completedAt) throw new ApiError("模拟考试已经结束", 409);
  return toPublicExamResult(session.correctCount, session.questions.length, session.passingCountSnapshot ?? session.questions.length, session.completedAt, session.examSettlementSource ?? "STUDENT_SUBMISSION");
}

async function findQuestionRecords(levelId: string, knowledgePointId?: string, knowledgePath?: string) {
  const knowledgeWhere = knowledgePointId && knowledgePath ? { OR: [{ id: knowledgePointId }, { path: { startsWith: `${knowledgePath}/` } }] } : undefined;
  return prisma.question.findMany({
    where: { levelId, status: "ACTIVE", knowledgePoint: knowledgeWhere ? { is: knowledgeWhere } : { is: { enabled: true } } },
    include: { level: { select: { code: true } }, knowledgePoint: { select: { name: true } } },
  });
}

async function findAnsweredQuestionIds(userId: string, levelId: string) {
  const answers = await prisma.practiceAnswer.findMany({ where: { session: { userId }, question: { levelId } }, select: { questionId: true }, distinct: ["questionId"] });
  return new Set(answers.map((answer) => answer.questionId));
}

function selectSequentialQuestions(questions: Question[], rule: { singleCount: number; multipleCount: number }) {
  const selectType = (type: Question["type"], count: number) => {
    const sorted = sortQuestionsByBankNumber(questions.filter((question) => question.type === type));
    if (sorted.length < count) throw new ApiError(`${type === "SINGLE_CHOICE" ? "单选" : "多选"}题库存不足`, 409);
    return sorted.slice(0, count);
  };
  return sortQuestionsByBankNumber([...selectType("SINGLE_CHOICE", rule.singleCount), ...selectType("MULTIPLE_CHOICE", rule.multipleCount)]);
}

function selectRandomQuestions(questions: Question[], answeredIds: ReadonlySet<string>, rule: { singleCount: number; multipleCount: number }) {
  const singles = questions.filter((question) => question.type === "SINGLE_CHOICE");
  const multiples = questions.filter((question) => question.type === "MULTIPLE_CHOICE");
  if (singles.length < rule.singleCount || multiples.length < rule.multipleCount) throw new ApiError("题库库存不足，无法创建随机练习", 409);
  return shuffle([
    ...selectPrioritizedRandomQuestions(singles, answeredIds, rule.singleCount),
    ...selectPrioritizedRandomQuestions(multiples, answeredIds, rule.multipleCount),
  ]);
}

function createSnapshots(records: QuestionRecord[], questions: Question[]) {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  return questions.map((question) => {
    const record = recordMap.get(question.id)!;
    return createQuestionSnapshot({ ...question, levelCode: record.level.code, knowledgeName: record.knowledgePoint.name });
  });
}

function toPublicSession(session: { id: string; mode: PracticeMode; status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED" }, snapshots: QuestionSnapshot[], results: Record<string, PublicAnswerResult>, exam?: { durationMinutes: number; passingCount: number; expiresAt: Date }, draft?: PublicPracticeSession["draft"], examResult?: PublicExamResult): PublicPracticeSession {
  return { id: session.id, mode: session.mode, status: session.status, title: sessionTitle(session.mode, snapshots), total: snapshots.length, questions: snapshots.map(toPublicQuestionSnapshot), initialResults: session.mode === "MOCK_EXAM" ? {} : results, ...(exam ? { exam: { durationMinutes: exam.durationMinutes, passingCount: exam.passingCount, expiresAt: exam.expiresAt.toISOString() } } : {}), ...(draft ? { draft } : {}), ...(examResult ? { examResult } : {}) };
}

async function getApprovedExplanations(questionIds: string[]): Promise<Array<StudentExplanation | null>> {
  if (questionIds.length === 0) return [];
  const rows = await prisma.question.findMany({
    where: { id: { in: questionIds }, explanationStatus: "APPROVED" },
    select: { id: true, explanation: true },
  });
  const byId = new Map(rows.map((row) => [row.id, parseStudentExplanation(row.explanation)]));
  return questionIds.map((id) => byId.get(id) ?? null);
}

async function getApprovedExplanation(questionId: string): Promise<StudentExplanation | null> {
  const row = await prisma.question.findFirst({
    where: { id: questionId, explanationStatus: "APPROVED" },
    select: { explanation: true },
  });
  return row ? parseStudentExplanation(row.explanation) : null;
}

function toPublicDraft(answers: unknown, currentIndex: number, version: number, updatedAt: Date): NonNullable<PublicPracticeSession["draft"]> {
  return { answers: parseExamDraftAnswers(answers), currentIndex, version, updatedAt: updatedAt.toISOString() };
}

function parseExamDraftAnswers(answers: unknown): Record<string, string[]> {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new ApiError("考试草稿数据损坏", 500);
  return Object.fromEntries(Object.entries(answers).map(([questionId, selectedOptionIds]) => [questionId, parseJsonStringArray(selectedOptionIds, "draft.answers")]));
}

function toPublicExamResult(correctCount: number, total: number, passingCount: number, completedAt: Date, settlementSource: ExamSettlementSource = "STUDENT_SUBMISSION"): PublicExamResult {
  return { correctCount, total, passingCount, passed: correctCount >= passingCount, settlementSource, completedAt: completedAt.toISOString() };
}

function validateSelection(snapshot: QuestionSnapshot, selectedOptionIds: string[], allowEmpty: boolean) {
  if (!allowEmpty && selectedOptionIds.length === 0) throw new ApiError("请先选择答案");
  if (snapshot.type === "SINGLE_CHOICE" && selectedOptionIds.length > 1) throw new ApiError("单选题只能选择一个答案");
  const validOptions = new Set(snapshot.options.map((option) => option.id));
  if (new Set(selectedOptionIds).size !== selectedOptionIds.length || selectedOptionIds.some((optionId) => !validOptions.has(optionId))) throw new ApiError("答案中包含无效选项");
}

function replayOrRejectPracticeAnswer(existing: { selectedOptionIds: unknown; isCorrect: boolean; answeredCountAtSubmission: number | null; correctCountAtSubmission: number | null }, snapshot: QuestionSnapshot, selectedOptionIds: string[]): PublicAnswerResult {
  const acceptedOptionIds = parseJsonStringArray(existing.selectedOptionIds, "selectedOptionIds");
  if (!hasSameOptionIds(acceptedOptionIds, selectedOptionIds)) throw new ApiError("本题答案已接受，不能覆盖", 409);
  if (existing.answeredCountAtSubmission === null || existing.correctCountAtSubmission === null) throw new ApiError("本题答案缺少可重放的结算结果", 409);
  return { isCorrect: existing.isCorrect, correctOptionIds: snapshot.correctOptionIds, selectedOptionIds: acceptedOptionIds, answeredCount: existing.answeredCountAtSubmission, correctCount: existing.correctCountAtSubmission };
}

function snapshotFromSessionQuestion(sessionQuestion: { snapshot: unknown }) {
  return sessionQuestion.snapshot as QuestionSnapshot;
}

function hasSameOptionIds(left: string[], right: string[]) {
  return left.length === right.length && new Set(left).size === left.length && left.every((optionId) => right.includes(optionId));
}

async function recordWrongQuestionAttempt(tx: Prisma.TransactionClient, userId: string, questionId: string, reason: "ANSWERED_WRONG" | "UNANSWERED") {
  await tx.wrongQuestion.upsert({
    where: { userId_questionId: { userId, questionId } },
    update: { wrongCount: { increment: 1 }, lastWrongReason: reason, lastWrongAt: new Date() },
    create: { userId, questionId, lastWrongReason: reason },
  });
}

async function settleWrongQuestionMastery(tx: Prisma.TransactionClient, userId: string, sessionId: string) {
  const session = await tx.practiceSession.findFirst({
    where: { id: sessionId, userId, status: "COMPLETED" },
    include: { answers: true },
  });
  if (!session) return;
  let newlyMasteredCount = 0;
  for (const answer of session.answers) {
    const current = await tx.wrongQuestion.findUnique({ where: { userId_questionId: { userId, questionId: answer.questionId } } });
    if (!current && answer.isCorrect) continue;
    const next = advanceWrongQuestionMastery(current ?? { correctSessionCount: 0, mastered: false, lastCountedSessionId: null }, answer.isCorrect ? "CORRECT" : "WRONG", sessionId);
    if (next.mastered && !(current?.mastered ?? false)) newlyMasteredCount += 1;
    const wrongReason = answer.isCorrect ? null : parseJsonStringArray(answer.selectedOptionIds, "selectedOptionIds").length ? "ANSWERED_WRONG" : "UNANSWERED";
    const shouldIncrementWrongCount = !answer.isCorrect && session.mode === "MOCK_EXAM";
    await tx.wrongQuestion.upsert({
      where: { userId_questionId: { userId, questionId: answer.questionId } },
      update: { ...(answer.isCorrect ? {} : { ...(shouldIncrementWrongCount ? { wrongCount: { increment: 1 } } : {}), lastWrongReason: wrongReason, lastWrongAt: new Date() }), correctSessionCount: next.correctSessionCount, mastered: next.mastered, lastCountedSessionId: next.lastCountedSessionId, masteredAt: next.mastered ? current?.masteredAt ?? new Date() : null },
      create: { userId, questionId: answer.questionId, wrongCount: answer.isCorrect ? 1 : 1, lastWrongReason: wrongReason, correctSessionCount: next.correctSessionCount, mastered: next.mastered, lastCountedSessionId: next.lastCountedSessionId, masteredAt: next.mastered ? new Date() : null },
    });
  }
  if (newlyMasteredCount > 0) {
    await awardWrongClearCompletion(tx, userId, newlyMasteredCount, sessionId);
  }
}

function sessionTitle(mode: PracticeMode, snapshots: QuestionSnapshot[]) {
  if (mode === "WRONG_QUESTION") return "错题巩固练习";
  const first = snapshots[0];
  if (mode === "KNOWLEDGE_POINT") return `${first.knowledgeName} · ${first.levelCode}级`;
  if (mode === "QUESTION_ORDER") return `${first.levelCode}级 · 顺序练习`;
  if (mode === "RANDOM_ALL") return `${first.levelCode}级 · 智能随机练习`;
  if (mode === "MOCK_EXAM") return `${first.levelCode}级 · 模拟考试`;
  return `${first.levelCode}级综合练习`;
}

function toDomainQuestion(record: Omit<QuestionRecord, "level" | "knowledgePoint"> | QuestionRecord): Question {
  return { id: record.id, levelId: record.levelId, knowledgePointId: record.knowledgePointId, sourceBankCode: record.sourceBankCode ?? undefined, externalQuestionCode: record.externalQuestionCode ?? undefined, stem: record.stem, type: record.type, optionCount: record.optionCount, correctOptionCount: record.correctOptionCount, selectionSpec: record.selectionSpec, preserveOptionOrder: record.preserveOptionOrder, options: record.options as QuestionOption[], correctOptionIds: parseJsonStringArray(record.correctOptionIds, "correctOptionIds"), status: record.status };
}
