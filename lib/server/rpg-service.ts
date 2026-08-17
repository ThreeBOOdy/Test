import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import {
  DAILY_QUEST_DEFS,
  DEFAULT_PLAYER_TITLE,
  QUEST_TYPES,
  XP_PER_FOCUS_SESSION,
  XP_PER_PRACTICE_QUESTION,
  XP_PER_REVIEW_CARD,
  XP_PER_WRONG_CLEAR,
  type PlayerLevelInfo,
  type PublicPlayerStatus,
  type PublicQuest,
  type QuestStatus,
  type QuestType,
} from "@/lib/domain/rpg";
import { getBusinessTimeZone } from "@/lib/server/env";
import { getBusinessDate } from "@/lib/server/time";

type DbClient = Prisma.TransactionClient | typeof prisma;

type QuestRow = {
  id: string;
  questDate: Date;
  type: string;
  target: number;
  progress: number;
  status: string;
  xpReward: number;
  completedAt: Date | null;
};

function dateOnlyValue(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function questOrder(type: QuestType) {
  return QUEST_TYPES.indexOf(type);
}

function deriveLevel(xp: number, levels: PlayerLevelInfo[]): PlayerLevelInfo {
  let current: PlayerLevelInfo = levels[0] ?? { level: 1, title: DEFAULT_PLAYER_TITLE, xpRequired: 0 };
  for (const level of levels) {
    if (xp >= level.xpRequired) current = level;
    else break;
  }
  return current;
}

function toPublicQuest(row: QuestRow): PublicQuest {
  const type = row.type as QuestType;
  const definition = DAILY_QUEST_DEFS[type];
  return {
    id: row.id,
    questDate: row.questDate.toISOString().slice(0, 10),
    type,
    title: definition.title,
    description: definition.description,
    target: row.target,
    progress: row.progress,
    status: row.status as QuestStatus,
    ready: row.status !== "COMPLETED" && row.progress >= row.target,
    xpReward: row.xpReward,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

async function ensurePlayerProfile(db: DbClient, userId: string) {
  return db.playerProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function ensureTodayQuests(
  db: DbClient,
  userId: string,
  now = new Date(),
  timeZone = getBusinessTimeZone(),
): Promise<QuestRow[]> {
  const dateString = getBusinessDate(now, timeZone);
  const questDate = dateOnlyValue(dateString);
  const existing = await db.questLog.findMany({ where: { userId, questDate } });
  const existingTypes = new Set(existing.map((quest) => quest.type));
  const missing = QUEST_TYPES.filter((type) => !existingTypes.has(type));
  if (missing.length > 0) {
    await db.questLog.createMany({
      data: missing.map((type) => ({
        userId,
        questDate,
        type,
        target: DAILY_QUEST_DEFS[type].target,
        xpReward: DAILY_QUEST_DEFS[type].xpReward,
      })),
      skipDuplicates: true,
    });
  }
  const rows = await db.questLog.findMany({ where: { userId, questDate } });
  return rows.sort((left, right) => questOrder(left.type as QuestType) - questOrder(right.type as QuestType));
}

export async function getPlayerStatus(
  userId: string,
  now = new Date(),
  timeZone = getBusinessTimeZone(),
): Promise<PublicPlayerStatus> {
  const [profile, levels, quests] = await Promise.all([
    ensurePlayerProfile(prisma, userId),
    prisma.playerLevel.findMany({ orderBy: { level: "asc" } }),
    ensureTodayQuests(prisma, userId, now, timeZone),
  ]);

  const levelInfo = deriveLevel(profile.xp, levels);
  const nextLevel = levels.find((level) => level.level === levelInfo.level + 1) ?? null;
  const currentLevelXp = levelInfo.xpRequired;
  const nextLevelXp = nextLevel?.xpRequired ?? null;
  const levelProgress = nextLevelXp == null
    ? 100
    : Math.min(100, Math.max(0, Math.round(((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100)));

  return {
    xp: profile.xp,
    level: levelInfo.level,
    title: levelInfo.title,
    currentLevelXp,
    nextLevelXp,
    levelProgress,
    gamificationEnabled: profile.gamificationEnabled,
    mapEnabled: profile.mapEnabled,
    todayQuests: quests.map(toPublicQuest),
  };
}

export async function getTodayQuests(
  userId: string,
  now = new Date(),
  timeZone = getBusinessTimeZone(),
): Promise<PublicQuest[]> {
  const quests = await ensureTodayQuests(prisma, userId, now, timeZone);
  return quests.map(toPublicQuest);
}

export async function completeQuest(userId: string, questId: string): Promise<PublicQuest> {
  const existing = await prisma.questLog.findFirst({ where: { id: questId, userId } });
  if (!existing) throw new ApiError("任务不存在", 404);
  if (existing.status === "COMPLETED") return toPublicQuest(existing);
  if (existing.progress < existing.target) throw new ApiError("任务尚未完成", 409);

  return prisma.$transaction(async (tx) => {
    const quest = await tx.questLog.findFirst({ where: { id: questId, userId } });
    if (!quest) throw new ApiError("任务不存在", 404);
    if (quest.status === "COMPLETED") return toPublicQuest(quest);
    if (quest.progress < quest.target) throw new ApiError("任务尚未完成", 409);

    const now = new Date();
    const updated = await tx.questLog.update({
      where: { id: questId },
      data: { status: "COMPLETED", completedAt: now },
    });
    await grantXp(tx, userId, updated.xpReward, "QUEST_REWARD", "QuestLog", questId);
    return toPublicQuest(updated);
  });
}

export async function updatePlayerProfile(
  userId: string,
  input: { gamificationEnabled?: boolean; mapEnabled?: boolean },
): Promise<PublicPlayerStatus> {
  const data: { gamificationEnabled?: boolean; mapEnabled?: boolean } = {};
  if (input.gamificationEnabled !== undefined) data.gamificationEnabled = input.gamificationEnabled;
  if (input.mapEnabled !== undefined) data.mapEnabled = input.mapEnabled;
  if (Object.keys(data).length === 0) return getPlayerStatus(userId);

  await prisma.playerProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  return getPlayerStatus(userId);
}

export async function setGamificationEnabled(userId: string, enabled: boolean): Promise<PublicPlayerStatus> {
  return updatePlayerProfile(userId, { gamificationEnabled: enabled });
}

export async function setMapEnabled(userId: string, enabled: boolean): Promise<PublicPlayerStatus> {
  return updatePlayerProfile(userId, { mapEnabled: enabled });
}

async function grantXp(
  db: DbClient,
  userId: string,
  amount: number,
  reason: string,
  sourceType?: string,
  sourceId?: string,
) {
  if (amount <= 0) return;
  const profile = await ensurePlayerProfile(db, userId);
  if (!profile.gamificationEnabled) return;

  const updated = await db.playerProfile.update({
    where: { userId },
    data: { xp: { increment: amount } },
  });
  const levels = await db.playerLevel.findMany({ orderBy: { level: "asc" } });
  const levelInfo = deriveLevel(updated.xp, levels);
  await db.playerProfile.update({
    where: { userId },
    data: { level: levelInfo.level, title: levelInfo.title },
  });
  await db.xpLog.create({
    data: { userId, amount, reason, sourceType, sourceId },
  });
}

async function progressQuest(
  db: DbClient,
  userId: string,
  type: QuestType,
  amount: number,
  now = new Date(),
  timeZone = getBusinessTimeZone(),
) {
  if (amount <= 0) return;
  const profile = await ensurePlayerProfile(db, userId);
  if (!profile.gamificationEnabled) return;

  await ensureTodayQuests(db, userId, now, timeZone);
  const dateString = getBusinessDate(now, timeZone);
  const questDate = dateOnlyValue(dateString);
  const quest = await db.questLog.findUnique({
    where: { userId_questDate_type: { userId, questDate, type } },
  });
  if (!quest || quest.status === "COMPLETED") return;

  const newProgress = Math.min(quest.target, quest.progress + amount);
  await db.questLog.update({
    where: { id: quest.id },
    data: { progress: newProgress },
  });
}

export async function awardPracticeCompletion(
  db: DbClient,
  userId: string,
  questionCount: number,
  sourceId?: string,
) {
  await grantXp(db, userId, questionCount * XP_PER_PRACTICE_QUESTION, "PRACTICE_QUESTION", "PracticeSession", sourceId);
  await progressQuest(db, userId, "PRACTICE", questionCount);
}

export async function awardReviewCompletion(
  db: DbClient,
  userId: string,
  cardCount: number,
  sourceId?: string,
) {
  await grantXp(db, userId, cardCount * XP_PER_REVIEW_CARD, "REVIEW_CARD", "ReviewCard", sourceId);
  await progressQuest(db, userId, "REVIEW", cardCount);
}

export async function awardFocusCompletion(
  db: DbClient,
  userId: string,
  sourceId?: string,
) {
  await grantXp(db, userId, XP_PER_FOCUS_SESSION, "FOCUS_SESSION", "FocusSession", sourceId);
  await progressQuest(db, userId, "FOCUS", 1);
}

export async function awardWrongClearCompletion(
  db: DbClient,
  userId: string,
  count: number,
  sourceId?: string,
) {
  await grantXp(db, userId, count * XP_PER_WRONG_CLEAR, "WRONG_CLEAR", "WrongQuestion", sourceId);
  await progressQuest(db, userId, "WRONG_CLEAR", count);
}
