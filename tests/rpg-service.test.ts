import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileUpsert: vi.fn(),
  profileUpdate: vi.fn(),
  levelFindMany: vi.fn(),
  questFindMany: vi.fn(),
  questCreateMany: vi.fn(),
  questFindUnique: vi.fn(),
  questFindFirst: vi.fn(),
  questUpdate: vi.fn(),
  xpLogCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    playerProfile: {
      upsert: mocks.profileUpsert,
      update: mocks.profileUpdate,
    },
    playerLevel: {
      findMany: mocks.levelFindMany,
    },
    questLog: {
      findMany: mocks.questFindMany,
      createMany: mocks.questCreateMany,
      findUnique: mocks.questFindUnique,
      findFirst: mocks.questFindFirst,
      update: mocks.questUpdate,
    },
    xpLog: {
      create: mocks.xpLogCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  awardFocusCompletion,
  awardPracticeCompletion,
  awardReviewCompletion,
  awardWrongClearCompletion,
  completeQuest,
  getPlayerStatus,
  getTodayQuests,
  setGamificationEnabled,
  setMapEnabled,
} from "@/lib/server/rpg-service";

const profile = {
  id: "profile-1",
  userId: "user-1",
  xp: 0,
  level: 1,
  title: "见习报务员",
  gamificationEnabled: true,
  mapEnabled: true,
  createdAt: new Date("2026-08-18T00:00:00.000Z"),
  updatedAt: new Date("2026-08-18T00:00:00.000Z"),
};

const levels = [
  { id: "level-1", level: 1, title: "见习报务员", xpRequired: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: "level-2", level: 2, title: "见习报务员", xpRequired: 80, createdAt: new Date(), updatedAt: new Date() },
  { id: "level-3", level: 3, title: "熟练操作员", xpRequired: 200, createdAt: new Date(), updatedAt: new Date() },
];

const questRows = [
  { id: "quest-practice", userId: "user-1", questDate: new Date("2026-08-18T00:00:00.000Z"), type: "PRACTICE", target: 20, progress: 0, status: "IN_PROGRESS", xpReward: 50, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "quest-review", userId: "user-1", questDate: new Date("2026-08-18T00:00:00.000Z"), type: "REVIEW", target: 5, progress: 0, status: "IN_PROGRESS", xpReward: 40, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "quest-wrong", userId: "user-1", questDate: new Date("2026-08-18T00:00:00.000Z"), type: "WRONG_CLEAR", target: 1, progress: 0, status: "IN_PROGRESS", xpReward: 30, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "quest-focus", userId: "user-1", questDate: new Date("2026-08-18T00:00:00.000Z"), type: "FOCUS", target: 1, progress: 0, status: "IN_PROGRESS", xpReward: 30, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
];

describe("rpg service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  describe("getPlayerStatus", () => {
    it("creates missing daily quests and returns level, title and quests", async () => {
      mocks.profileUpsert.mockResolvedValue(profile);
      mocks.levelFindMany.mockResolvedValue(levels);
      mocks.questFindMany.mockResolvedValueOnce([]).mockResolvedValue(questRows);
      mocks.questCreateMany.mockResolvedValue({ count: 4 });

      const result = await getPlayerStatus("user-1", new Date("2026-08-18T12:00:00.000Z"), "UTC");

      expect(result).toMatchObject({
        xp: 0,
        level: 1,
        title: "见习报务员",
        currentLevelXp: 0,
        nextLevelXp: 80,
        levelProgress: 0,
        gamificationEnabled: true,
        mapEnabled: true,
      });
      expect(result.todayQuests).toHaveLength(4);
      expect(result.todayQuests[0]).toMatchObject({ type: "PRACTICE", target: 20, xpReward: 50 });
      expect(mocks.questCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ type: "REVIEW", target: 5, xpReward: 40 }),
          expect.objectContaining({ type: "FOCUS", target: 1, xpReward: 30 }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe("getTodayQuests", () => {
    it("returns quests in canonical order", async () => {
      mocks.questFindMany.mockResolvedValueOnce([]).mockResolvedValue(questRows);
      mocks.questCreateMany.mockResolvedValue({ count: 4 });

      const result = await getTodayQuests("user-1", new Date("2026-08-18T12:00:00.000Z"), "UTC");

      expect(result.map((quest) => quest.type)).toEqual(["PRACTICE", "REVIEW", "WRONG_CLEAR", "FOCUS"]);
    });
  });

  describe("setGamificationEnabled", () => {
    it("updates the profile flag and returns refreshed status", async () => {
      mocks.profileUpsert.mockResolvedValue({ ...profile, gamificationEnabled: false });
      mocks.levelFindMany.mockResolvedValue(levels);
      mocks.questFindMany.mockResolvedValueOnce([]).mockResolvedValue(questRows);
      mocks.questCreateMany.mockResolvedValue({ count: 4 });

      const result = await setGamificationEnabled("user-1", false);

      expect(mocks.profileUpsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        update: { gamificationEnabled: false },
        create: { userId: "user-1", gamificationEnabled: false },
      });
      expect(result.gamificationEnabled).toBe(false);
    });
  });

  describe("setMapEnabled", () => {
    it("updates the map entry flag and returns refreshed status", async () => {
      mocks.profileUpsert.mockResolvedValue({ ...profile, mapEnabled: false });
      mocks.levelFindMany.mockResolvedValue(levels);
      mocks.questFindMany.mockResolvedValueOnce([]).mockResolvedValue(questRows);
      mocks.questCreateMany.mockResolvedValue({ count: 4 });

      const result = await setMapEnabled("user-1", false);

      expect(mocks.profileUpsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        update: { mapEnabled: false },
        create: { userId: "user-1", mapEnabled: false },
      });
      expect(result.mapEnabled).toBe(false);
    });
  });

  describe("completeQuest", () => {
    it("completes a ready quest and grants its XP reward", async () => {
      const readyQuest = { ...questRows[0], progress: 20 };
      const completedQuest = { ...readyQuest, status: "COMPLETED", completedAt: new Date("2026-08-18T12:30:00.000Z") };
      mocks.questFindFirst.mockResolvedValue(readyQuest);
      mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          questLog: {
            findFirst: mocks.questFindFirst,
            update: mocks.questUpdate,
          },
          playerProfile: {
            upsert: mocks.profileUpsert,
            update: mocks.profileUpdate,
          },
          playerLevel: {
            findMany: mocks.levelFindMany,
          },
          xpLog: {
            create: mocks.xpLogCreate,
          },
        };
        return fn(tx);
      });
      mocks.questUpdate.mockResolvedValue(completedQuest);
      mocks.profileUpsert.mockResolvedValue(profile);
      mocks.profileUpdate.mockResolvedValue({ ...profile, xp: 50 });
      mocks.levelFindMany.mockResolvedValue(levels);
      mocks.xpLogCreate.mockResolvedValue({ id: "xp-1" });

      const result = await completeQuest("user-1", "quest-practice");

      expect(result.status).toBe("COMPLETED");
      expect(mocks.questUpdate).toHaveBeenCalledWith({
        where: { id: "quest-practice" },
        data: expect.objectContaining({ status: "COMPLETED", completedAt: expect.any(Date) }),
      });
      expect(mocks.xpLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-1", amount: 50, reason: "QUEST_REWARD", sourceType: "QuestLog", sourceId: "quest-practice" }),
      });
    });

    it("rejects a quest that has not reached its target", async () => {
      mocks.questFindFirst.mockResolvedValue(questRows[0]);
      await expect(completeQuest("user-1", "quest-practice")).rejects.toMatchObject({ status: 409 });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("award helpers", () => {
    const tx = {
      playerProfile: {
        upsert: mocks.profileUpsert,
        update: mocks.profileUpdate,
      },
      playerLevel: {
        findMany: mocks.levelFindMany,
      },
      questLog: {
        findMany: mocks.questFindMany,
        createMany: mocks.questCreateMany,
        findUnique: mocks.questFindUnique,
        update: mocks.questUpdate,
      },
      xpLog: {
        create: mocks.xpLogCreate,
      },
    } as never;

    beforeEach(() => {
      mocks.profileUpsert.mockResolvedValue(profile);
      mocks.profileUpdate.mockResolvedValue({ ...profile, xp: 50, level: 2, title: "见习报务员" });
      mocks.levelFindMany.mockResolvedValue(levels);
      mocks.xpLogCreate.mockResolvedValue({ id: "xp-1" });
      mocks.questFindMany.mockResolvedValueOnce([]).mockResolvedValue(questRows);
      mocks.questCreateMany.mockResolvedValue({ count: 4 });
      mocks.questFindUnique.mockResolvedValue(questRows[0]);
      mocks.questUpdate.mockResolvedValue({ ...questRows[0], progress: 2 });
    });

    it("awards practice XP and progresses the practice quest", async () => {
      await awardPracticeCompletion(tx, "user-1", 4, "session-1");

      expect(mocks.profileUpdate).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { xp: { increment: 20 } },
      });
      expect(mocks.xpLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 20, reason: "PRACTICE_QUESTION", sourceType: "PracticeSession", sourceId: "session-1" }),
      });
      expect(mocks.questUpdate).toHaveBeenCalledWith({
        where: { id: "quest-practice" },
        data: { progress: 4 },
      });
    });

    it("awards review, focus and wrong-clear XP", async () => {
      await awardReviewCompletion(tx, "user-1", 2, "card-1");
      expect(mocks.profileUpdate).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { xp: { increment: 20 } },
      });

      mocks.profileUpdate.mockClear();
      await awardFocusCompletion(tx, "user-1", "focus-1");
      expect(mocks.profileUpdate).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { xp: { increment: 30 } },
      });

      mocks.profileUpdate.mockClear();
      await awardWrongClearCompletion(tx, "user-1", 1, "wrong-1");
      expect(mocks.profileUpdate).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { xp: { increment: 20 } },
      });
    });

    it("does not grant XP when gamification is disabled", async () => {
      mocks.profileUpsert.mockResolvedValue({ ...profile, gamificationEnabled: false });
      await awardPracticeCompletion(tx, "user-1", 4, "session-1");

      expect(mocks.profileUpdate).not.toHaveBeenCalled();
      expect(mocks.xpLogCreate).not.toHaveBeenCalled();
      expect(mocks.questUpdate).not.toHaveBeenCalled();
    });
  });
});
