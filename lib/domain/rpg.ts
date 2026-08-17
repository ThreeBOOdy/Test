export const QUEST_TYPES = ["PRACTICE", "REVIEW", "WRONG_CLEAR", "FOCUS"] as const;

export type QuestType = (typeof QUEST_TYPES)[number];
export type QuestStatus = "IN_PROGRESS" | "COMPLETED";

export const XP_PER_PRACTICE_QUESTION = 5;
export const XP_PER_REVIEW_CARD = 10;
export const XP_PER_FOCUS_SESSION = 30;
export const XP_PER_WRONG_CLEAR = 20;

export const DEFAULT_PLAYER_TITLE = "见习报务员";

export const DAILY_QUEST_DEFS: Record<QuestType, { title: string; description: string; target: number; xpReward: number }> = {
  PRACTICE: {
    title: "今日刷题",
    description: "在完成的练习中累计答完题目",
    target: 20,
    xpReward: 50,
  },
  REVIEW: {
    title: "今日复习",
    description: "完成复习计划中的卡片",
    target: 5,
    xpReward: 40,
  },
  WRONG_CLEAR: {
    title: "错题清零",
    description: "将错题巩固为已掌握",
    target: 1,
    xpReward: 30,
  },
  FOCUS: {
    title: "专注训练",
    description: "完成一次专注目标",
    target: 1,
    xpReward: 30,
  },
};

export type PlayerLevelInfo = {
  level: number;
  title: string;
  xpRequired: number;
};

export type PublicQuest = {
  id: string;
  questDate: string;
  type: QuestType;
  title: string;
  description: string;
  target: number;
  progress: number;
  status: QuestStatus;
  ready: boolean;
  xpReward: number;
  completedAt: string | null;
};

export type PublicPlayerStatus = {
  xp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number | null;
  levelProgress: number;
  gamificationEnabled: boolean;
  mapEnabled: boolean;
  todayQuests: PublicQuest[];
};
