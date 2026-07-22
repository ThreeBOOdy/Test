import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { selectPracticeQuestions, shuffle } from "@/lib/domain/practice-engine";
import { createQuestionSnapshot, gradeQuestionSnapshot, toPublicQuestionSnapshot, type QuestionSnapshot } from "@/lib/domain/practice-snapshot";
import type { PracticeMode, PublicPracticeSession, Question, QuestionOption } from "@/lib/domain/types";

type CreatePracticeRequest = { mode: "level" | "knowledge" | "wrong"; levelCode?: string; knowledgePointId?: string };

export async function createPracticeSession(userId: string, input: CreatePracticeRequest): Promise<PublicPracticeSession> {
  if (input.mode === "wrong") return createWrongQuestionSession(userId);
  const level = await prisma.level.findFirst({ where: { code: input.levelCode, enabled: true } });
  if (!level) throw new ApiError("所选等级不存在或已停用", 404);
  const mode: PracticeMode = input.mode === "knowledge" ? "KNOWLEDGE_POINT" : "LEVEL_COMPREHENSIVE";
  const point = input.knowledgePointId ? await prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, enabled: true } }) : null;
  if (mode === "KNOWLEDGE_POINT" && !point) throw new ApiError("所选知识点不存在或已停用", 404);

  const rule = mode === "KNOWLEDGE_POINT"
    ? await prisma.knowledgePracticeRule.findUnique({ where: { knowledgePointId_levelId: { knowledgePointId: point!.id, levelId: level.id } } })
    : await prisma.levelPracticeRule.findUnique({ where: { levelId: level.id } });
  if (!rule || !rule.enabled || (rule.singleCount === 0 && rule.multipleCount === 0)) throw new ApiError("教师尚未配置该练习的抽题规则", 409);

  const knowledgeWhere = point ? { OR: [{ id: point.id }, { path: { startsWith: `${point.path}/` } }] } : undefined;
  const records = await prisma.question.findMany({
    where: { levelId: level.id, status: "ACTIVE", knowledgePoint: knowledgeWhere ? { is: knowledgeWhere } : { is: { enabled: true } } },
    include: { level: { select: { code: true } }, knowledgePoint: { select: { name: true } } },
  });
  const domainQuestions = records.map(toDomainQuestion);
  const selection = selectPracticeQuestions(domainQuestions, { mode, levelId: level.id, knowledgePointIds: point ? [...new Set(domainQuestions.map((question) => question.knowledgePointId))] : undefined, rule: { singleCount: rule.singleCount, multipleCount: rule.multipleCount } });
  const snapshots = selection.questions.map((question) => {
    const record = records.find((item) => item.id === question.id)!;
    return createQuestionSnapshot({ ...question, levelCode: record.level.code, knowledgeName: record.knowledgePoint.name });
  });
  return persistPracticeSession(userId, mode, level.id, point?.id ?? null, snapshots);
}

async function createWrongQuestionSession(userId: string): Promise<PublicPracticeSession> {
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { userId, mastered: false, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } },
    include: { question: { include: { level: { select: { code: true } }, knowledgePoint: { select: { name: true } } } } },
  });
  const selected = shuffle(wrongQuestions).slice(0, 20);
  if (!selected.length) throw new ApiError("当前没有待巩固错题", 409);
  const snapshots = selected.map(({ question }) => createQuestionSnapshot({
    ...toDomainQuestion(question),
    levelCode: question.level.code,
    knowledgeName: question.knowledgePoint.name,
  }));
  return persistPracticeSession(userId, "WRONG_QUESTION", null, null, snapshots);
}

async function persistPracticeSession(userId: string, mode: PracticeMode, levelId: string | null, knowledgePointId: string | null, snapshots: QuestionSnapshot[]): Promise<PublicPracticeSession> {
  const singleCount = snapshots.filter((snapshot) => snapshot.type === "SINGLE_CHOICE").length;
  const multipleCount = snapshots.length - singleCount;
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.practiceSession.create({ data: { userId, mode, levelId, knowledgePointId, singleCountSnapshot: singleCount, multipleCountSnapshot: multipleCount } });
    await tx.practiceSessionQuestion.createMany({ data: snapshots.map((snapshot, position) => ({ sessionId: created.id, questionId: snapshot.questionId, position, snapshot: snapshot as unknown as Prisma.InputJsonValue })) });
    return created;
  });
  return { id: session.id, mode, title: sessionTitle(mode, snapshots), total: snapshots.length, questions: snapshots.map(toPublicQuestionSnapshot), initialResults: {} };
}

export async function getPracticeSession(userId: string, sessionId: string): Promise<PublicPracticeSession | null> {
  const session = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
    include: { questions: { orderBy: { position: "asc" } }, answers: true },
  });
  if (!session) return null;
  const snapshots = session.questions.map((item) => item.snapshot as unknown as QuestionSnapshot);
  const correctCount = session.answers.filter((answer) => answer.isCorrect).length;
  const results = Object.fromEntries(session.answers.map((answer) => {
    const snapshot = snapshots.find((item) => item.questionId === answer.questionId);
    return [answer.questionId, { isCorrect: answer.isCorrect, correctOptionIds: snapshot?.correctOptionIds ?? [], selectedOptionIds: answer.selectedOptionIds, answeredCount: session.answers.length, correctCount }];
  }));
  return { id: session.id, mode: session.mode, title: sessionTitle(session.mode, snapshots), total: snapshots.length, questions: snapshots.map(toPublicQuestionSnapshot), initialResults: results };
}

export async function submitPracticeAnswer(userId: string, sessionId: string, questionId: string, selectedOptionIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const sessionQuestion = await tx.practiceSessionQuestion.findUnique({ where: { sessionId_questionId: { sessionId, questionId } }, include: { session: true } });
    if (!sessionQuestion || sessionQuestion.session.userId !== userId) throw new ApiError("题目不属于当前练习", 404);
    if (sessionQuestion.session.status !== "IN_PROGRESS") throw new ApiError("练习已经结束", 409);
    const existing = await tx.practiceAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
    if (existing) throw new ApiError("本题已经提交，不能重复修改", 409);
    const snapshot = sessionQuestion.snapshot as unknown as QuestionSnapshot;
    if (selectedOptionIds.length !== snapshot.correctOptionCount) throw new ApiError(`本题要求选择 ${snapshot.correctOptionCount} 项`);
    const validOptions = new Set(snapshot.options.map((option) => option.id));
    if (new Set(selectedOptionIds).size !== selectedOptionIds.length || selectedOptionIds.some((optionId) => !validOptions.has(optionId))) throw new ApiError("答案中包含无效选项");

    const isCorrect = gradeQuestionSnapshot(snapshot, selectedOptionIds);
    await tx.practiceAnswer.create({ data: { sessionId, questionId, selectedOptionIds, isCorrect } });
    if (isCorrect) {
      await tx.wrongQuestion.updateMany({ where: { userId, questionId, mastered: false }, data: { mastered: true, masteredAt: new Date() } });
    } else {
      await tx.wrongQuestion.upsert({ where: { userId_questionId: { userId, questionId } }, update: { wrongCount: { increment: 1 }, lastWrongAt: new Date(), mastered: false, masteredAt: null }, create: { userId, questionId } });
    }
    const [answeredCount, correctCount, total] = await Promise.all([tx.practiceAnswer.count({ where: { sessionId } }), tx.practiceAnswer.count({ where: { sessionId, isCorrect: true } }), tx.practiceSessionQuestion.count({ where: { sessionId } })]);
    await tx.practiceSession.update({ where: { id: sessionId }, data: { currentIndex: answeredCount, correctCount, ...(answeredCount === total ? { status: "COMPLETED", completedAt: new Date() } : {}) } });
    return { isCorrect, correctOptionIds: snapshot.correctOptionIds, selectedOptionIds, answeredCount, correctCount };
  });
}

function sessionTitle(mode: PracticeMode, snapshots: QuestionSnapshot[]) {
  if (mode === "WRONG_QUESTION") return "错题巩固练习";
  const first = snapshots[0];
  return mode === "KNOWLEDGE_POINT" ? `${first.knowledgeName} · ${first.levelCode}级` : `${first.levelCode}级综合练习`;
}

function toDomainQuestion(record: { id: string; levelId: string; knowledgePointId: string; sourceBankCode: string | null; externalQuestionCode: string | null; stem: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; optionCount: number; correctOptionCount: number; selectionSpec: string; options: unknown; correctOptionIds: string[]; status: "ACTIVE" | "DISABLED" | "ARCHIVED" }): Question {
  return { ...record, sourceBankCode: record.sourceBankCode ?? undefined, externalQuestionCode: record.externalQuestionCode ?? undefined, options: record.options as QuestionOption[] };
}
