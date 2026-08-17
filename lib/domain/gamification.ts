export const AI_DISCLAIMER = "AI 生成，仅供参考";

export type MilestoneEvent =
  | { type: "LEVEL_UP"; level: number; title: string }
  | { type: "QUEST_COMPLETE"; questTitle: string; xpReward: number }
  | { type: "BOSS_CLEAR"; correct: number; total: number; passed: boolean };

export type DailyEncouragement = {
  text: string;
  model: string;
  generatedAt: string;
  disclaimer: string;
};

export type MilestoneFeedback = {
  text: string;
  model: string;
  generatedAt: string;
  disclaimer: string;
};
