import "server-only";
import { prisma } from "@/lib/db";
import { isAnswerCorrect, selectPracticeQuestions } from "@/lib/domain/practice-engine";
import type { PracticeMode, PublicPracticeSession, PublicQuestion, Question, QuestionOption } from "@/lib/domain/types";

export async function createPracticeSession(userId: string, input: { mode: "level" | "knowledge"; levelCode: string; knowledgePointId?: string }): Promise<PublicPracticeSession> {
  const level = await prisma.level.findFirst({ where: { code: input.levelCode, enabled: true } });
  if (!level) throw new Error("所选等级不存在或已停用");
  const mode: PracticeMode = input.mode === "knowledge" ? "KNOWLEDGE_POINT" : "LEVEL_COMPREHENSIVE";
  const point = input.knowledgePointId ? await prisma.knowledgePoint.findFirst({ where: { id: input.knowledgePointId, enabled: true } }) : null;
  if (mode === "KNOWLEDGE_POINT" && !point) throw new Error("所选知识点不存在或已停用");

  const rule = mode === "KNOWLEDGE_POINT"
    ? await prisma.knowledgePracticeRule.findUnique({ where: { knowledgePointId_levelId: { knowledgePointId: point!.id, levelId: level.id } } })
    : await prisma.levelPracticeRule.findUnique({ where: { levelId: level.id } });
  if (!rule || !rule.enabled || (rule.singleCount === 0 && rule.multipleCount === 0)) throw new Error("教师尚未配置该练习的抽题规则");

  const knowledgeWhere = point ? { OR: [{ id: point.id }, { path: { startsWith: `${point.path}/` } }] } : undefined;
  const records = await prisma.question.findMany({
    where: {
      levelId: level.id,
      status: "ACTIVE",
      knowledgePoint: knowledgeWhere ? { is: knowledgeWhere } : { is: { enabled: true } },
    },
  });
  const domainQuestions = records.map(toDomainQuestion);
  const selection = selectPracticeQuestions(domainQuestions, {
    mode,
    levelId: level.id,
    knowledgePointIds: point ? [...new Set(domainQuestions.map((question) => question.knowledgePointId))] : undefined,
    rule: { singleCount: rule.singleCount, multipleCount: rule.multipleCount },
  });

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.practiceSession.create({
      data: {
        userId,
        mode,
        levelId: level.id,
        knowledgePointId: point?.id,
        singleCountSnapshot: selection.singleCount,
        multipleCountSnapshot: selection.multipleCount,
      },
    });
    await tx.practiceSessionQuestion.createMany({ data: selection.questions.map((question, position) => ({ sessionId: created.id, questionId: question.id, position })) });
    return created;
  });

  return {
    id: session.id,
    mode,
    title: point ? `${point.name} · ${level.code}级` : `${level.code}级综合练习`,
    total: selection.questions.length,
    questions: await Promise.all(selection.questions.map((question) => toPublicQuestion(question))),
    initialResults: {},
  };
}

export async function getPracticeSession(userId: string, sessionId: string): Promise<PublicPracticeSession | null> {
  const session = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      level: true,
      knowledgePoint: true,
      questions: { orderBy: { position: "asc" }, include: { question: { include: { level: true, knowledgePoint: true } } } },
      answers: true,
    },
  });
  if (!session) return null;
  const correctCount = session.answers.filter((answer) => answer.isCorrect).length;
  const results = Object.fromEntries(session.answers.map((answer) => {
    const question = session.questions.find((item) => item.questionId === answer.questionId)?.question;
    return [answer.questionId, {
      isCorrect: answer.isCorrect,
      correctOptionIds: question?.correctOptionIds ?? [],
      selectedOptionIds: answer.selectedOptionIds,
      answeredCount: session.answers.length,
      correctCount,
    }];
  }));
  return {
    id: session.id,
    mode: session.mode,
    title: session.knowledgePoint ? `${session.knowledgePoint.name} · ${session.level.code}级` : `${session.level.code}级综合练习`,
    total: session.questions.length,
    questions: session.questions.map(({ question }) => toPublicQuestionFromRecord(question)),
    initialResults: results,
  };
}

export async function submitPracticeAnswer(userId: string, sessionId: string, questionId: string, selectedOptionIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const sessionQuestion = await tx.practiceSessionQuestion.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
      include: { session: true, question: true },
    });
    if (!sessionQuestion || sessionQuestion.session.userId !== userId) throw new Error("题目不属于当前练习");
    if (sessionQuestion.session.status !== "IN_PROGRESS") throw new Error("练习已经结束");
    const existing = await tx.practiceAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
    if (existing) throw new Error("本题已经提交，不能重复修改");
    if (selectedOptionIds.length !== sessionQuestion.question.correctOptionCount) throw new Error(`本题要求选择 ${sessionQuestion.question.correctOptionCount} 项`);
    const validOptions = new Set((sessionQuestion.question.options as QuestionOption[]).map((option) => option.id));
    if (selectedOptionIds.some((optionId) => !validOptions.has(optionId))) throw new Error("答案中包含无效选项");

    const isCorrect = isAnswerCorrect(selectedOptionIds, sessionQuestion.question.correctOptionIds);
    await tx.practiceAnswer.create({ data: { sessionId, questionId, selectedOptionIds, isCorrect } });
    if (isCorrect) {
      await tx.wrongQuestion.updateMany({ where: { userId, questionId, mastered: false }, data: { mastered: true, masteredAt: new Date() } });
    } else {
      await tx.wrongQuestion.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: { wrongCount: { increment: 1 }, lastWrongAt: new Date(), mastered: false, masteredAt: null },
        create: { userId, questionId },
      });
    }

    const [answeredCount, correctCount, total] = await Promise.all([
      tx.practiceAnswer.count({ where: { sessionId } }),
      tx.practiceAnswer.count({ where: { sessionId, isCorrect: true } }),
      tx.practiceSessionQuestion.count({ where: { sessionId } }),
    ]);
    await tx.practiceSession.update({
      where: { id: sessionId },
      data: {
        currentIndex: answeredCount,
        correctCount,
        ...(answeredCount === total ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
    });
    return { isCorrect, correctOptionIds: sessionQuestion.question.correctOptionIds, selectedOptionIds, answeredCount, correctCount };
  });
}

function toDomainQuestion(record: { id: string; levelId: string; knowledgePointId: string; sourceBankCode: string | null; externalQuestionCode: string | null; stem: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; optionCount: number; correctOptionCount: number; selectionSpec: string; options: unknown; correctOptionIds: string[]; status: "ACTIVE" | "DISABLED" | "ARCHIVED" }): Question {
  return { ...record, sourceBankCode: record.sourceBankCode ?? undefined, externalQuestionCode: record.externalQuestionCode ?? undefined, options: record.options as QuestionOption[] };
}

async function toPublicQuestion(question: Question): Promise<PublicQuestion> {
  const [point, level] = await Promise.all([
    prisma.knowledgePoint.findUnique({ where: { id: question.knowledgePointId }, select: { name: true } }),
    prisma.level.findUnique({ where: { id: question.levelId }, select: { code: true } }),
  ]);
  const { correctOptionIds: _correct, status: _status, ...safe } = question;
  void _correct; void _status;
  return { ...safe, knowledgeName: point?.name ?? "未分类", levelCode: level?.code ?? "-" };
}

function toPublicQuestionFromRecord(record: { id: string; levelId: string; knowledgePointId: string; sourceBankCode: string | null; externalQuestionCode: string | null; stem: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; optionCount: number; correctOptionCount: number; selectionSpec: string; options: unknown; level: { code: string }; knowledgePoint: { name: string } }): PublicQuestion {
  return { id: record.id, levelId: record.levelId, knowledgePointId: record.knowledgePointId, sourceBankCode: record.sourceBankCode ?? undefined, externalQuestionCode: record.externalQuestionCode ?? undefined, stem: record.stem, type: record.type, optionCount: record.optionCount, correctOptionCount: record.correctOptionCount, selectionSpec: record.selectionSpec, options: record.options as QuestionOption[], levelCode: record.level.code, knowledgeName: record.knowledgePoint.name };
}
