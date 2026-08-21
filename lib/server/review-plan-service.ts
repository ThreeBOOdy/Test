import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { buildPracticeLaunchHref } from "@/lib/domain/practice-launcher";
import {
  buildReviewCards,
  computeExamSprintTarget,
  DAILY_REVIEW_TARGET,
  type FsrsDueQuestionCandidate,
  type QuestionCandidate,
  type ReviewCardDraft,
  type WeakKnowledgeCandidate,
} from "@/lib/domain/review-plan-engine";
import type {
  PublicReviewCard,
  PublicReviewPlan,
  ReviewCardSource,
  ReviewCardStatus,
  ReviewPlanType,
} from "@/lib/domain/review-plan";
import { awardReviewCompletion } from "@/lib/server/rpg-service";
import { getStudentActiveLevelAccess } from "@/lib/server/student-level-access";
import { getBusinessDate } from "@/lib/server/time";

type PlanWithCards = Prisma.ReviewPlanGetPayload<{
  include: {
    cards: {
      orderBy: [{ status: "asc" }, { priority: "desc" }];
      include: {
        knowledgePoint: { select: { name: true } };
        question: {
          include: {
            levels: { include: { level: { select: { code: true } } } };
            knowledgePoint: { select: { name: true } };
          };
        };
      };
    };
  };
}>;

const planInclude = {
  cards: {
    orderBy: [{ status: "desc" }, { priority: "desc" }] as const,
    include: {
      knowledgePoint: { select: { name: true } },
      question: {
        include: {
          levels: { include: { level: { select: { code: true } } } },
          knowledgePoint: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.ReviewPlanInclude;

function dateOnlyValue(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function daysBetween(startDate: string, endDate: string) {
  const start = dateOnlyValue(startDate).getTime();
  const end = dateOnlyValue(endDate).getTime();
  return Math.round((end - start) / 86_400_000);
}

function toPublicPlan(plan: PlanWithCards): PublicReviewPlan {
  const cards = plan.cards.map((card) => {
    const knowledgeName = card.question.knowledgePoint.name;
    const levelCode = card.question.levels[0]?.level.code ?? "未归类";
    const launchHref = card.source === "WRONG_QUESTION"
      ? buildPracticeLaunchHref({ mode: "WRONG_QUESTION", questionId: card.questionId })
      : buildPracticeLaunchHref({
          mode: "KNOWLEDGE_POINT",
          levelCode,
          knowledgePointId: card.knowledgePointId ?? card.question.knowledgePointId,
        });
    return {
      id: card.id,
      questionId: card.questionId,
      knowledgePointId: card.knowledgePointId,
      knowledgeName,
      levelCode,
      stem: card.question.stem,
      source: card.source,
      priority: card.priority,
      status: card.status,
      completedAt: card.completedAt?.toISOString() ?? null,
      launchHref,
    };
  });
  return {
    id: plan.id,
    planDate: plan.planDate.toISOString().slice(0, 10),
    type: plan.type,
    status: plan.status,
    examDate: plan.examDate?.toISOString().slice(0, 10) ?? null,
    completedAt: plan.completedAt?.toISOString() ?? null,
    total: cards.length,
    completed: cards.filter((card) => card.status === "COMPLETED").length,
    cards,
  };
}

async function findPlan(userId: string, planDate: Date, type: ReviewPlanType) {
  return prisma.reviewPlan.findUnique({
    where: { userId_planDate_type: { userId, planDate, type } },
    include: planInclude,
  });
}

async function getPlanById(userId: string, planId: string): Promise<PublicReviewPlan> {
  const plan = await prisma.reviewPlan.findFirst({
    where: { id: planId, userId },
    include: planInclude,
  });
  if (!plan) throw new ApiError("复习计划不存在", 404);
  return toPublicPlan(plan);
}

export async function getTodayReviewPlan(userId: string, now = new Date()): Promise<PublicReviewPlan> {
  const dateString = getBusinessDate(now);
  const planDate = dateOnlyValue(dateString);
  const existing = await findPlan(userId, planDate, "DAILY");
  if (existing) return toPublicPlan(existing);
  return generateReviewPlan(userId, { type: "DAILY", planDate: dateString }, now);
}

export async function generateReviewPlan(
  userId: string,
  input: { type?: ReviewPlanType; planDate?: string; examDate?: string },
  now = new Date(),
): Promise<PublicReviewPlan> {
  const type = input.type ?? "DAILY";
  const planDate = input.planDate ?? getBusinessDate(now);
  const planDateValue = dateOnlyValue(planDate);
  if (type === "EXAM_SPRINT" && !input.examDate) throw new ApiError("考前冲刺需要考试日期", 400);

  const existing = await findPlan(userId, planDateValue, type);
  if (existing) return toPublicPlan(existing);

  const access = await getStudentActiveLevelAccess(userId);
  const activeLevel = access.activeLevel && access.activeLevel.enabled ? access.activeLevel : null;
  const levelId = activeLevel?.id ?? null;

  const dueQuestions: FsrsDueQuestionCandidate[] = [];
  let weakKnowledgePoints: WeakKnowledgeCandidate[] = [];
  let questions: QuestionCandidate[] = [];

  if (levelId) {
    const [states, activeQuestions] = await Promise.all([
      prisma.studentLevelQuestionState.findMany({
        where: {
          userId,
          levelId,
          reps: { gt: 0 },
          question: { status: "ACTIVE", knowledgePoint: { enabled: true } },
        },
        select: {
          questionId: true,
          dueAt: true,
          difficulty: true,
          stability: true,
          lapses: true,
          wrongCount: true,
          favorite: true,
          ignored: true,
          lastReviewedAt: true,
          correctCount: true,
          question: { select: { knowledgePointId: true } },
        },
      }),
      prisma.question.findMany({
        where: { status: "ACTIVE", knowledgePoint: { enabled: true }, levels: { some: { levelId } } },
        select: { id: true, knowledgePointId: true },
      }),
    ]);

    const nowTime = now.getTime();
    for (const state of states) {
      if (state.dueAt && state.dueAt.getTime() <= nowTime) {
        dueQuestions.push({
          questionId: state.questionId,
          knowledgePointId: state.question.knowledgePointId,
          dueAt: state.dueAt,
          difficulty: state.difficulty,
          stability: state.stability,
          lapses: state.lapses,
          wrongCount: state.wrongCount,
          favorite: state.favorite,
          ignored: state.ignored,
          lastReviewedAt: state.lastReviewedAt,
        });
      }
    }

    const statsByPoint = new Map<string, { answered: number; correct: number; maxDifficulty: number; totalLapses: number }>();
    for (const state of states) {
      const pointId = state.question.knowledgePointId;
      const current = statsByPoint.get(pointId) ?? { answered: 0, correct: 0, maxDifficulty: 0, totalLapses: 0 };
      current.answered += state.correctCount + state.wrongCount;
      current.correct += state.correctCount;
      current.maxDifficulty = Math.max(current.maxDifficulty, state.difficulty);
      current.totalLapses += state.lapses;
      statsByPoint.set(pointId, current);
    }
    weakKnowledgePoints = [...statsByPoint.entries()].map(([knowledgePointId, stats]) => ({
      knowledgePointId,
      answered: stats.answered,
      correct: stats.correct,
      accuracy: stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0,
      maxDifficulty: stats.maxDifficulty,
      totalLapses: stats.totalLapses,
    }));

    questions = activeQuestions;
  }

  let target = DAILY_REVIEW_TARGET;
  if (type === "EXAM_SPRINT" && input.examDate) {
    const daysUntilExam = daysBetween(planDate, input.examDate);
    const totalCandidates = dueQuestions.length + weakKnowledgePoints.length;
    target = computeExamSprintTarget({ totalCandidates, daysUntilExam });
  }

  const drafts: ReviewCardDraft[] = buildReviewCards({
    dueQuestions,
    weakKnowledgePoints,
    questions,
    target,
  });

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.reviewPlan.create({
        data: {
          userId,
          planDate: planDateValue,
          type,
          examDate: input.examDate ? dateOnlyValue(input.examDate) : null,
        },
      });
      if (drafts.length) {
        await tx.reviewCard.createMany({
          data: drafts.map((draft) => ({
            reviewPlanId: created.id,
            questionId: draft.questionId,
            knowledgePointId: draft.knowledgePointId,
            source: draft.source,
            priority: draft.priority,
          })),
        });
      }
      return created;
    });
    return getPlanById(userId, plan.id);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await findPlan(userId, planDateValue, type);
    if (!existing) throw error;
    return toPublicPlan(existing);
  }
}

export async function completeReviewCard(userId: string, planId: string, cardId: string): Promise<PublicReviewCard> {
  return prisma.$transaction(async (tx) => {
    const card = await tx.reviewCard.findFirst({
      where: { id: cardId, reviewPlanId: planId, reviewPlan: { userId } },
      select: { id: true, reviewPlanId: true, status: true },
    });
    if (!card) throw new ApiError("复习任务不存在", 404);
    if (card.status === "COMPLETED") {
      const existing = await tx.reviewCard.findUniqueOrThrow({
        where: { id: cardId },
        include: {
          question: {
            include: {
              levels: { include: { level: { select: { code: true } } } },
              knowledgePoint: { select: { name: true } },
            },
          },
        },
      });
      return toPublicCard(existing);
    }

    const now = new Date();
    const updated = await tx.reviewCard.update({
      where: { id: cardId },
      data: { status: "COMPLETED", completedAt: now },
      include: {
        question: {
          include: {
            levels: { include: { level: { select: { code: true } } } },
            knowledgePoint: { select: { name: true } },
          },
        },
      },
    });

    const pendingCount = await tx.reviewCard.count({ where: { reviewPlanId: card.reviewPlanId, status: "PENDING" } });
    if (pendingCount === 0) {
      await tx.reviewPlan.updateMany({
        where: { id: card.reviewPlanId, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: now },
      });
    }
    await awardReviewCompletion(tx, userId, 1, cardId);
    return toPublicCard(updated);
  });
}

export async function completeReviewCardsForSession(
  userId: string,
  sessionId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ completed: number; plansCompleted: number }> {
  const db = tx ?? prisma;
  const answers = await db.practiceAnswer.findMany({
    where: { sessionId, session: { userId } },
    select: { questionId: true },
  });
  const questionIds = [...new Set(answers.map((answer) => answer.questionId))];
  if (!questionIds.length) return { completed: 0, plansCompleted: 0 };

  const cards = await db.reviewCard.findMany({
    where: {
      reviewPlan: { userId, status: "ACTIVE" },
      questionId: { in: questionIds },
      status: "PENDING",
    },
    select: { id: true, reviewPlanId: true },
  });
  if (!cards.length) return { completed: 0, plansCompleted: 0 };

  const now = new Date();
  await db.reviewCard.updateMany({
    where: { id: { in: cards.map((card) => card.id) } },
    data: { status: "COMPLETED", completedAt: now },
  });

  const planIds = [...new Set(cards.map((card) => card.reviewPlanId))];
  let plansCompleted = 0;
  for (const planId of planIds) {
    const pendingCount = await db.reviewCard.count({ where: { reviewPlanId: planId, status: "PENDING" } });
    if (pendingCount === 0) {
      await db.reviewPlan.updateMany({
        where: { id: planId, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: now },
      });
      plansCompleted += 1;
    }
  }
  await awardReviewCompletion(db, userId, cards.length, sessionId);
  return { completed: cards.length, plansCompleted };
}

function toPublicCard(card: {
  id: string;
  questionId: string;
  knowledgePointId: string | null;
  source: ReviewCardSource;
  priority: number;
  status: ReviewCardStatus;
  completedAt: Date | null;
  question: {
    stem: string;
    knowledgePointId: string;
    levels: Array<{ level: { code: string } }>;
    knowledgePoint: { name: string };
  };
}): PublicReviewCard {
  const launchHref = card.source === "WRONG_QUESTION"
    ? buildPracticeLaunchHref({ mode: "WRONG_QUESTION", questionId: card.questionId })
    : buildPracticeLaunchHref({
        mode: "KNOWLEDGE_POINT",
        levelCode: card.question.levels[0]?.level.code ?? "未归类",
        knowledgePointId: card.knowledgePointId ?? card.question.knowledgePointId,
      });
  return {
    id: card.id,
    questionId: card.questionId,
    knowledgePointId: card.knowledgePointId,
    knowledgeName: card.question.knowledgePoint.name,
    levelCode: card.question.levels[0]?.level.code ?? "未归类",
    stem: card.question.stem,
    source: card.source,
    priority: card.priority,
    status: card.status,
    completedAt: card.completedAt?.toISOString() ?? null,
    launchHref,
  };
}
