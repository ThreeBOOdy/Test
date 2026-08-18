import type { KnowledgePoint, Level, PracticeRule, Question } from "@/lib/domain/types";

export const levels: Level[] = [
  { id: "level-a", code: "A", name: "A级 · 基础掌握", sortOrder: 1, enabled: true },
  { id: "level-b", code: "B", name: "B级 · 能力进阶", sortOrder: 2, enabled: true },
  { id: "level-c", code: "C", name: "C级 · 综合挑战", sortOrder: 3, enabled: true },
];

export const knowledgePoints: KnowledgePoint[] = [
  { id: "kp-4", code: "4", name: "电工电子基础", parentId: null, path: "/4", depth: 0, sortOrder: 1, enabled: true },
  { id: "kp-41", code: "4.1", name: "电学基础概念", parentId: "kp-4", path: "/4/4.1", depth: 1, sortOrder: 1, enabled: true },
  { id: "kp-411", code: "4.1.1", name: "导体与绝缘体", parentId: "kp-41", path: "/4/4.1/4.1.1", depth: 2, sortOrder: 1, enabled: true },
  { id: "kp-412", code: "4.1.2", name: "电源与电流", parentId: "kp-41", path: "/4/4.1/4.1.2", depth: 2, sortOrder: 2, enabled: true },
  { id: "kp-413", code: "4.1.3", name: "电压、电阻与功率", parentId: "kp-41", path: "/4/4.1/4.1.3", depth: 2, sortOrder: 3, enabled: true },
  { id: "kp-42", code: "4.2", name: "半导体器件", parentId: "kp-4", path: "/4/4.2", depth: 1, sortOrder: 2, enabled: true },
  { id: "kp-421", code: "4.2.1", name: "二极管与三极管", parentId: "kp-42", path: "/4/4.2/4.2.1", depth: 2, sortOrder: 1, enabled: true },
];

export const levelRules: Record<string, PracticeRule> = {
  "level-a": { singleCount: 6, multipleCount: 4 },
  "level-b": { singleCount: 6, multipleCount: 4 },
  "level-c": { singleCount: 6, multipleCount: 4 },
};

export const knowledgeRules: Record<string, PracticeRule> = {
  "kp-41:level-a": { singleCount: 4, multipleCount: 2 },
  "kp-411:level-a": { singleCount: 3, multipleCount: 2 },
  "kp-412:level-a": { singleCount: 3, multipleCount: 2 },
  "kp-413:level-a": { singleCount: 3, multipleCount: 2 },
  "kp-421:level-a": { singleCount: 3, multipleCount: 2 },
  "kp-411:level-b": { singleCount: 3, multipleCount: 2 },
  "kp-412:level-b": { singleCount: 3, multipleCount: 2 },
  "kp-413:level-b": { singleCount: 3, multipleCount: 2 },
};

const singleTemplates = [
  ["下列材料中，通常属于良导体的是？", ["铜", "玻璃", "橡胶", "陶瓷"], ["A"]],
  ["电流的国际单位是？", ["伏特", "安培", "欧姆", "瓦特"], ["B"]],
  ["电压的国际单位是？", ["安培", "焦耳", "伏特", "欧姆"], ["C"]],
  ["电阻的国际单位是？", ["欧姆", "瓦特", "库仑", "赫兹"], ["A"]],
  ["直流电的电流方向通常如何变化？", ["周期变化", "方向不变", "随机变化", "瞬间消失"], ["B"]],
  ["功率的国际单位是？", ["伏特", "瓦特", "安培", "欧姆"], ["B"]],
];

const multipleTemplates = [
  ["下列哪些材料通常属于绝缘体？", ["橡胶", "玻璃", "铜", "陶瓷"], ["A", "B", "D"]],
  ["下列哪些量可以描述基本电路状态？", ["电流", "电压", "电阻", "颜色"], ["A", "B", "C"]],
  ["安全用电应做到哪些？", ["保持干燥", "破损电线继续使用", "切断电源后检修", "使用合格器材"], ["A", "C", "D"]],
  ["下列属于常见半导体器件的有？", ["二极管", "三极管", "熔断器", "集成电路"], ["A", "B", "D"]],
];

const leafKnowledgeIds = ["kp-411", "kp-412", "kp-413", "kp-421"];

function createQuestions(): Question[] {
  const result: Question[] = [];
  for (const [levelIndex, level] of levels.entries()) {
    for (let cycle = 0; cycle < 2; cycle += 1) {
      singleTemplates.forEach(([stem, rawOptions, correct], index) => {
        const options = (rawOptions as string[]).map((text, optionIndex) => ({ id: String.fromCharCode(65 + optionIndex), text }));
        result.push({
          id: `${level.code}-S-${cycle}-${index}`,
          levelIds: [level.id],
          knowledgePointId: leafKnowledgeIds[(index + cycle + levelIndex) % leafKnowledgeIds.length],
          sourceBankCode: `LK${1000 + levelIndex * 100 + cycle * 10 + index}`,
          externalQuestionCode: `MC1-${1000 + levelIndex * 100 + cycle * 10 + index}`,
          stem: `${stem}${cycle === 1 ? "（变式）" : ""}`,
          type: "SINGLE_CHOICE",
          optionCount: options.length,
          correctOptionCount: 1,
          selectionSpec: `${options.length}选1`,
          options,
          correctOptionIds: correct as string[],
          status: "ACTIVE",
        });
      });
      multipleTemplates.forEach(([stem, rawOptions, correct], index) => {
        const options = (rawOptions as string[]).map((text, optionIndex) => ({ id: String.fromCharCode(65 + optionIndex), text }));
        const correctIds = correct as string[];
        result.push({
          id: `${level.code}-M-${cycle}-${index}`,
          levelIds: [level.id],
          knowledgePointId: leafKnowledgeIds[(index + cycle + levelIndex) % leafKnowledgeIds.length],
          sourceBankCode: `LK${2000 + levelIndex * 100 + cycle * 10 + index}`,
          externalQuestionCode: `MC${correctIds.length}-${2000 + levelIndex * 100 + cycle * 10 + index}`,
          stem: `${stem}${cycle === 1 ? "（变式）" : ""}`,
          type: "MULTIPLE_CHOICE",
          optionCount: options.length,
          correctOptionCount: correctIds.length,
          selectionSpec: `${options.length}选${correctIds.length}`,
          options,
          correctOptionIds: correctIds,
          status: "ACTIVE",
        });
      });
    }
  }
  return result;
}

export const questions = createQuestions();

export const recentHistory = [
  { id: "h1", title: "A级综合练习", detail: "10题 · 7分32秒", score: 0.9, date: "今天 09:42", tone: "green" as const },
  { id: "h2", title: "导体与绝缘体 · A级", detail: "5题 · 4分08秒", score: 0.8, date: "昨天 19:10", tone: "blue" as const },
  { id: "h3", title: "电源与电流 · A级", detail: "5题 · 3分51秒", score: 0.6, date: "7月15日", tone: "amber" as const },
];
