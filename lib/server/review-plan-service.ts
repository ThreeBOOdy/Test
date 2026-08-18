import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { buildPracticeLaunchHref } from "@/lib/domain/practice-launcher";
import {
  buildReviewCards,
  computeExamSprintTarget,
  DAILY_REVIEW_TARGET,
  type ReviewCardDraft,
} from "@/lib/domain/review-plan-engine";
import type {
  PublicReviewCard,
  PublicReviewPlan,
  ReviewCardSource,
  ReviewCardStatus,
  ReviewPlanType,
} from "@/lib/domain/review-plan";
import { awardReviewCompletion } from "@/lib/server/rpg-service";
import { getBusinessDate } from "@/lib/server/time";

const WEAK_KNOWLEDGE_WINDOW_DAYS = 14;

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

  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { userId, mastered: false, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } },
    select: {
      questionId: true,
      wrongCount: true,
      lastWrongAt: true,
      question: { select: { knowledgePointId: true } },
    },
  });
  const wrongCandidates = wrongQuestions.map((item) => ({
    questionId: item.questionId,
    knowledgePointId: item.question.knowledgePointId,
    wrongCount: item.wrongCount,
    lastWrongAt: item.lastWrongAt,
  }));

  const since = new Date(now);
  since.setDate(since.getDate() - WEAK_KNOWLEDGE_WINDOW_DAYS);
  const weakRows = await prisma.$queryRaw<Array<{ knowledgePointId: string; answered: number; correct: number }>>(Prisma.sql`
    SELECT q.\`knowledgePointId\` AS knowledgePointId,
           CAST(COUNT(pa.id) AS SIGNED) AS answered,
           CAST(COALESCE(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END), 0) AS SIGNED) AS correct
    FROM \`PracticeAnswer\` pa
    JOIN \`PracticeSession\` ps ON ps.id = pa.\`sessionId\`
    JOIN \`Question\` q ON q.id = pa.\`questionId\`
    WHERE ps.\`userId\` = ${userId} AND ps.\`status\` = 'COMPLETED' AND ps.\`completedAt\` >= ${since}
    GROUP BY q.\`knowledgePointId\`
  `);
  const weakKnowledgePoints = weakRows.map((row) => {
    const answered = Number(row.answered);
    const correct = Number(row.correct);
    return {
      knowledgePointId: row.knowledgePointId,
      answered,
      correct,
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    };
  });

  const weakPointIds = weakKnowledgePoints.map((point) => point.knowledgePointId);
  const questions = weakPointIds.length
    ? await prisma.question.findMany({
        where: { status: "ACTIVE", knowledgePoint: { enabled: true, id: { in: weakPointIds } } },
        select: { id: true, knowledgePointId: true },
      })
    : [];

  let target = DAILY_REVIEW_TARGET;
  if (type === "EXAM_SPRINT" && input.examDate) {
    const daysUntilExam = daysBetween(planDate, input.examDate);
    const totalCandidates = wrongCandidates.length + weakKnowledgePoints.length;
    target = computeExamSprintTarget({ totalCandidates, daysUntilExam });
  }

  const drafts: ReviewCardDraft[] = buildReviewCards({
    wrongQuestions: wrongCandidates,
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
