import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import type { FocusOverview, FocusSessionStatus, PublicFocusSession } from "@/lib/domain/types";
import { getBusinessTimeZone } from "@/lib/server/env";
import { getBusinessDate } from "@/lib/server/time";
import { awardFocusCompletion } from "@/lib/server/rpg-service";

export type StartFocusInput = {
  targetMinutes?: number;
  targetQuestionCount?: number;
};

export type CompleteFocusInput = {
  completed: boolean;
  actualQuestionCount?: number;
};

type FocusSessionRecord = {
  id: string;
  status: string;
  targetMinutes: number | null;
  targetQuestionCount: number | null;
  actualMinutes: number | null;
  actualQuestionCount: number | null;
  startedAt: Date;
  endedAt: Date | null;
};

export async function startFocusSession(userId: string, input: StartFocusInput): Promise<PublicFocusSession> {
  const hasTarget = input.targetMinutes != null || input.targetQuestionCount != null;
  if (!hasTarget) throw new ApiError("请设置目标时长或目标题量", 400);
  validatePositiveTarget(input.targetMinutes, "目标时长");
  validatePositiveTarget(input.targetQuestionCount, "目标题量");

  const active = await prisma.focusSession.findFirst({ where: { userId, status: "IN_PROGRESS" } });
  if (active) throw new ApiError("已有进行中的专注，请先结束", 409);

  const created = await prisma.focusSession.create({
    data: {
      userId,
      targetMinutes: input.targetMinutes ?? null,
      targetQuestionCount: input.targetQuestionCount ?? null,
    },
  });
  return toPublicFocusSession(created);
}

export async function completeFocusSession(userId: string, sessionId: string, input: CompleteFocusInput): Promise<PublicFocusSession> {
  const existing = await prisma.focusSession.findFirst({ where: { id: sessionId, userId } });
  if (!existing) throw new ApiError("专注会话不存在", 404);
  if (existing.status !== "IN_PROGRESS") throw new ApiError("专注会话已结束", 409);

  const endedAt = new Date();
  const actualMinutes = Math.max(0, Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 60_000));

  if (input.completed) {
    if (existing.targetQuestionCount != null && input.actualQuestionCount == null) {
      throw new ApiError("请填写实际完成题量", 400);
    }
    const actualQuestionCount = input.actualQuestionCount ?? 0;
    const reachedMinutes = existing.targetMinutes == null || actualMinutes >= existing.targetMinutes;
    const reachedQuestions = existing.targetQuestionCount == null || actualQuestionCount >= existing.targetQuestionCount;
    if (!reachedMinutes || !reachedQuestions) {
      throw new ApiError("尚未达到目标，不能标记完成", 409);
    }
  }

  const updated = await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      status: input.completed ? "COMPLETED" : "ABANDONED",
      actualMinutes,
      actualQuestionCount: input.completed ? (input.actualQuestionCount ?? null) : null,
      endedAt,
    },
  });
  if (input.completed) {
    await awardFocusCompletion(prisma, userId, sessionId);
  }
  return toPublicFocusSession(updated);
}

export async function getFocusOverview(userId: string, now = new Date(), timeZone = getBusinessTimeZone()): Promise<FocusOverview> {
  const [activeFocus, completedFocus, completedPractice, completedReviews] = await Promise.all([
    prisma.focusSession.findFirst({ where: { userId, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" } }),
    prisma.focusSession.findMany({ where: { userId, status: "COMPLETED" }, select: { startedAt: true, actualMinutes: true } }),
    prisma.practiceSession.findMany({ where: { userId, status: "COMPLETED" }, select: { startedAt: true } }),
    prisma.reviewPlan.findMany({ where: { userId, status: "COMPLETED" }, select: { completedAt: true } }),
  ]);

  const today = getBusinessDate(now, timeZone);
  const checkedDates = new Set<string>();
  for (const item of completedPractice) checkedDates.add(getBusinessDate(item.startedAt, timeZone));
  for (const item of completedFocus) checkedDates.add(getBusinessDate(item.startedAt, timeZone));
  for (const item of completedReviews) {
    if (item.completedAt) checkedDates.add(getBusinessDate(item.completedAt, timeZone));
  }

  const todayFocusMinutes = completedFocus.reduce((sum, item) => (
    getBusinessDate(item.startedAt, timeZone) === today ? sum + (item.actualMinutes ?? 0) : sum
  ), 0);

  return {
    currentStreak: calculateStudyStreak(checkedDates, today),
    todayCheckedIn: checkedDates.has(today),
    todayFocusMinutes,
    activeFocusSession: activeFocus ? toPublicFocusSession(activeFocus) : null,
  };
}

export function calculateStudyStreak(checkedDates: Set<string>, today: string): number {
  const cursor = checkedDates.has(today) ? today : shiftDateString(today, -1);
  let streak = 0;
  let day = cursor;
  while (checkedDates.has(day)) {
    streak += 1;
    day = shiftDateString(day, -1);
  }
  return streak;
}

export function shiftDateString(date: string, offsetDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

function validatePositiveTarget(value: number | undefined, label: string) {
  if (value == null) return;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(`${label}必须是正整数`, 400);
  }
}

function toPublicFocusSession(session: FocusSessionRecord): PublicFocusSession {
  return {
    id: session.id,
    status: session.status as FocusSessionStatus,
    targetMinutes: session.targetMinutes,
    targetQuestionCount: session.targetQuestionCount,
    actualMinutes: session.actualMinutes,
    actualQuestionCount: session.actualQuestionCount,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
  };
}
