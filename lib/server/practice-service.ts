import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { parseJsonStringArray } from "@/lib/domain/json-string-array";
import { selectPracticeQuestions, selectPrioritizedRandomQuestions, shuffle, sortQuestionsByBankNumber } from "@/lib/domain/practice-engine";
import { createQuestionSnapshot, gradeQuestionSnapshot, toPublicQuestionSnapshot, type QuestionSnapshot } from "@/lib/domain/practice-snapshot";
import type { ExamRule, PracticeMode, PublicAnswerResult, PublicPracticeSession, Question, QuestionOption } from "@/lib/domain/types";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

type CreatePracticeRequest =
  | { mode: "level" | "order" | "random" | "exam"; levelCode: string }
  | { mode: "knowledge"; levelCode: string; knowledgePointId: string }
  | { mode: "wrong" };

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
  if (input.mode === "wrong") return createWrongQuestionSession(userId);
  const level = await prisma.level.findFirst({ where: { courseId: RADIO_COURSE_ID, code: input.levelCode, enabled: true } });
  if (!level) throw new ApiError("所选等级不存在或已停用", 404);
  if (input.mode === "exam") return createMockExamSession(userId, level.id);

  const mode: PracticeMode = input.mode === "knowledge" ? "KNOWLEDGE_POINT" : input.mode === "order" ? "QUESTION_ORDER" : input.mode === "random" ? "RANDOM_ALL" : "LEVEL_COMPREHENSIVE";
  const point = input.mode === "knowledge" ? await prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, courseId: RADIO_COURSE_ID, enabled: true } }) : null;
  if (input.mode === "knowledge" && !point) throw new ApiError("所选知识点不存在或已停用", 404);

  const rule = input.mode === "knowledge"
    ? await prisma.knowledgePracticeRule.findUnique({ where: { courseId_knowledgePointId_levelId: { courseId: RADIO_COURSE_ID, knowledgePointId: point!.id, levelId: level.id } } })
    : await prisma.levelPracticeRule.findFirst({ where: { courseId: RADIO_COURSE_ID, levelId: level.id } });
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
  const rule = await prisma.examRule.findFirst({ where: { courseId: RADIO_COURSE_ID, levelId } });
  if (!rule || !rule.enabled) throw new ApiError("教师尚未配置该等级的模拟考试", 409);
  const records = await findQuestionRecords(levelId);
  const questions = selectPracticeQuestions(records.map(toDomainQuestion), { mode: "MOCK_EXAM", levelId, rule }).questions;
  return persistPracticeSession(userId, "MOCK_EXAM", levelId, null, createSnapshots(records, questions), {
    durationMinutes: rule.durationMinutes,
    passingCount: rule.passingCount,
  });
}

async function createWrongQuestionSession(userId: string): Promise<PublicPracticeSession> {
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { courseId: RADIO_COURSE_ID, userId, mastered: false, question: { courseId: RADIO_COURSE_ID, status: "ACTIVE", knowledgePoint: { courseId: RADIO_COURSE_ID, enabled: true } } },
    include: { question: { include: { level: { select: { code: true } }, knowledgePoint: { select: { name: true } } } } },
  });
  const selected = shuffle(wrongQuestions).slice(0, 20);
  if (!selected.length) throw new ApiError("当前没有待巩固错题", 409);
  const snapshots = selected.map(({ question }) => createQuestionSnapshot({ ...toDomainQuestion(question), levelCode: question.level.code, knowledgeName: question.knowledgePoint.name }));
  return persistPracticeSession(userId, "WRONG_QUESTION", null, null, snapshots);
}

async function persistPracticeSession(userId: string, mode: PracticeMode, levelId: string | null, knowledgePointId: string | null, snapshots: QuestionSnapshot[], examRule?: Pick<ExamRule, "durationMinutes" | "passingCount">): Promise<PublicPracticeSession> {
  const singleCount = snapshots.filter((snapshot) => snapshot.type === "SINGLE_CHOICE").length;
  const multipleCount = snapshots.length - singleCount;
  const startedAt = new Date();
  const expiresAt = examRule ? new Date(startedAt.getTime() + examRule.durationMinutes * 60_000) : null;
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.practiceSession.create({ data: { courseId: RADIO_COURSE_ID, userId, mode, levelId, knowledgePointId, singleCountSnapshot: singleCount, multipleCountSnapshot: multipleCount, startedAt, expiresAt, durationMinutesSnapshot: examRule?.durationMinutes, passingCountSnapshot: examRule?.passingCount } });
    await tx.practiceSessionQuestion.createMany({ data: snapshots.map((snapshot, position) => ({ courseId: RADIO_COURSE_ID, sessionId: created.id, questionId: snapshot.questionId, position, snapshot: snapshot as unknown as Prisma.InputJsonValue })) });
    return created;
  });
  return toPublicSession(session, snapshots, {}, examRule && expiresAt ? { ...examRule, expiresAt } : undefined);
}

export async function getPracticeSession(userId: string, sessionId: string): Promise<PublicPracticeSession | null> {
  const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, courseId: RADIO_COURSE_ID, userId }, include: { questions: { orderBy: { position: "asc" } }, answers: { where: { courseId: RADIO_COURSE_ID } } } });
  if (!session) return null;
  const snapshots = session.questions.map((item) => item.snapshot as unknown as QuestionSnapshot);
  const correctCount = session.answers.filter((answer) => answer.isCorrect).length;
  const results = Object.fromEntries(session.answers.map((answer) => {
    const snapshot = snapshots.find((item) => item.questionId === answer.questionId);
    return [answer.questionId, { isCorrect: answer.isCorrect, correctOptionIds: snapshot?.correctOptionIds ?? [], selectedOptionIds: parseJsonStringArray(answer.selectedOptionIds, "selectedOptionIds"), answeredCount: session.answers.length, correctCount }];
  }));
  const exam = session.mode === "MOCK_EXAM" && session.durationMinutesSnapshot && session.passingCountSnapshot && session.expiresAt
    ? { durationMinutes: session.durationMinutesSnapshot, passingCount: session.passingCountSnapshot, expiresAt: session.expiresAt }
    : undefined;
  return toPublicSession(session, snapshots, results, exam);
}

export async function submitPracticeAnswer(userId: string, sessionId: string, questionId: string, selectedOptionIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const sessionQuestion = await tx.practiceSessionQuestion.findUnique({ where: { courseId_sessionId_questionId: { courseId: RADIO_COURSE_ID, sessionId, questionId } }, include: { session: true } });
    if (!sessionQuestion || sessionQuestion.session.courseId !== RADIO_COURSE_ID || sessionQuestion.session.userId !== userId) throw new ApiError("题目不属于当前练习", 404);
    if (sessionQuestion.session.mode === "MOCK_EXAM") throw new ApiError("模拟考试请统一交卷", 409);
    if (sessionQuestion.session.status !== "IN_PROGRESS") throw new ApiError("练习已经结束", 409);
    const existing = await tx.practiceAnswer.findUnique({ where: { courseId_sessionId_questionId: { courseId: RADIO_COURSE_ID, sessionId, questionId } } });
    if (existing) throw new ApiError("本题已经提交，不能重复修改", 409);
    const snapshot = sessionQuestion.snapshot as unknown as QuestionSnapshot;
    validateSelection(snapshot, selectedOptionIds, false);
    const isCorrect = gradeQuestionSnapshot(snapshot, selectedOptionIds);
    await tx.practiceAnswer.create({ data: { courseId: RADIO_COURSE_ID, sessionId, questionId, selectedOptionIds: selectedOptionIds as Prisma.InputJsonValue, isCorrect } });
    await updateWrongQuestion(tx, userId, questionId, isCorrect);
    const [answeredCount, correctCount, total] = await Promise.all([tx.practiceAnswer.count({ where: { courseId: RADIO_COURSE_ID, sessionId } }), tx.practiceAnswer.count({ where: { courseId: RADIO_COURSE_ID, sessionId, isCorrect: true } }), tx.practiceSessionQuestion.count({ where: { courseId: RADIO_COURSE_ID, sessionId } })]);
    await tx.practiceSession.update({ where: { id: sessionId }, data: { currentIndex: answeredCount, correctCount, ...(answeredCount === total ? { status: "COMPLETED", completedAt: new Date() } : {}) } });
    return { isCorrect, correctOptionIds: snapshot.correctOptionIds, selectedOptionIds, answeredCount, correctCount };
  });
}

export async function submitMockExam(userId: string, sessionId: string, submittedAnswers: { questionId: string; selectedOptionIds: string[] }[]) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.practiceSession.findFirst({ where: { id: sessionId, courseId: RADIO_COURSE_ID, userId }, include: { questions: { orderBy: { position: "asc" } }, answers: { where: { courseId: RADIO_COURSE_ID } } } });
    if (!session) throw new ApiError("模拟考试不存在", 404);
    if (session.mode !== "MOCK_EXAM") throw new ApiError("当前会话不是模拟考试", 409);
    if (session.status !== "IN_PROGRESS" || session.answers.length) throw new ApiError("模拟考试已经交卷", 409);
    const answerMap = new Map(submittedAnswers.map((answer) => [answer.questionId, answer.selectedOptionIds]));
    if (answerMap.size !== submittedAnswers.length) throw new ApiError("答卷中包含重复题目");
    const sessionQuestionIds = new Set(session.questions.map((item) => item.questionId));
    if (submittedAnswers.some((answer) => !sessionQuestionIds.has(answer.questionId))) throw new ApiError("答卷中包含无效题目");

    const graded = session.questions.map((item) => {
      const snapshot = item.snapshot as unknown as QuestionSnapshot;
      const selectedOptionIds = answerMap.get(item.questionId) ?? [];
      validateSelection(snapshot, selectedOptionIds, true);
      return { questionId: item.questionId, snapshot, selectedOptionIds, isCorrect: gradeQuestionSnapshot(snapshot, selectedOptionIds) };
    });
    await tx.practiceAnswer.createMany({ data: graded.map((answer) => ({ courseId: RADIO_COURSE_ID, sessionId, questionId: answer.questionId, selectedOptionIds: answer.selectedOptionIds as Prisma.InputJsonValue, isCorrect: answer.isCorrect })) });
    for (const answer of graded) await updateWrongQuestion(tx, userId, answer.questionId, answer.isCorrect);
    const correctCount = graded.filter((answer) => answer.isCorrect).length;
    const completedAt = new Date();
    await tx.practiceSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", currentIndex: graded.length, correctCount, completedAt } });
    const results = Object.fromEntries(graded.map((answer) => [answer.questionId, { isCorrect: answer.isCorrect, correctOptionIds: answer.snapshot.correctOptionIds, selectedOptionIds: answer.selectedOptionIds, answeredCount: graded.length, correctCount } satisfies PublicAnswerResult]));
    const passingCount = session.passingCountSnapshot ?? graded.length;
    return { results, correctCount, total: graded.length, passingCount, passed: correctCount >= passingCount, completedAt: completedAt.toISOString() };
  });
}

async function findQuestionRecords(levelId: string, knowledgePointId?: string, knowledgePath?: string) {
  const knowledgeWhere = knowledgePointId && knowledgePath ? { OR: [{ id: knowledgePointId }, { path: { startsWith: `${knowledgePath}/` } }] } : undefined;
  return prisma.question.findMany({
    where: { courseId: RADIO_COURSE_ID, levelId, status: "ACTIVE", knowledgePoint: knowledgeWhere ? { is: { courseId: RADIO_COURSE_ID, ...knowledgeWhere } } : { is: { courseId: RADIO_COURSE_ID, enabled: true } } },
    include: { level: { select: { code: true } }, knowledgePoint: { select: { name: true } } },
  });
}

async function findAnsweredQuestionIds(userId: string, levelId: string) {
  const answers = await prisma.practiceAnswer.findMany({ where: { courseId: RADIO_COURSE_ID, session: { courseId: RADIO_COURSE_ID, userId }, question: { courseId: RADIO_COURSE_ID, levelId } }, select: { questionId: true }, distinct: ["questionId"] });
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

function toPublicSession(session: { id: string; mode: PracticeMode }, snapshots: QuestionSnapshot[], results: Record<string, PublicAnswerResult>, exam?: { durationMinutes: number; passingCount: number; expiresAt: Date }): PublicPracticeSession {
  return { id: session.id, mode: session.mode, title: sessionTitle(session.mode, snapshots), total: snapshots.length, questions: snapshots.map(toPublicQuestionSnapshot), initialResults: results, ...(exam ? { exam: { durationMinutes: exam.durationMinutes, passingCount: exam.passingCount, expiresAt: exam.expiresAt.toISOString() } } : {}) };
}

function validateSelection(snapshot: QuestionSnapshot, selectedOptionIds: string[], allowEmpty: boolean) {
  if (!allowEmpty && selectedOptionIds.length === 0) throw new ApiError("请先选择答案");
  if (snapshot.type === "SINGLE_CHOICE" && selectedOptionIds.length > 1) throw new ApiError("单选题只能选择一个答案");
  const validOptions = new Set(snapshot.options.map((option) => option.id));
  if (new Set(selectedOptionIds).size !== selectedOptionIds.length || selectedOptionIds.some((optionId) => !validOptions.has(optionId))) throw new ApiError("答案中包含无效选项");
}

async function updateWrongQuestion(tx: Prisma.TransactionClient, userId: string, questionId: string, isCorrect: boolean) {
  if (isCorrect) await tx.wrongQuestion.updateMany({ where: { courseId: RADIO_COURSE_ID, userId, questionId, mastered: false }, data: { mastered: true, masteredAt: new Date() } });
  else await tx.wrongQuestion.upsert({ where: { courseId_userId_questionId: { courseId: RADIO_COURSE_ID, userId, questionId } }, update: { wrongCount: { increment: 1 }, lastWrongAt: new Date(), mastered: false, masteredAt: null }, create: { courseId: RADIO_COURSE_ID, userId, questionId } });
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
