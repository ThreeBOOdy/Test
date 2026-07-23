import type { PublicPracticeSession } from "@/lib/domain/types";

export function practiceSessionFixture(overrides: Partial<PublicPracticeSession> = {}): PublicPracticeSession {
  return {
    id: "session-1",
    mode: "LEVEL_COMPREHENSIVE",
    title: "A级综合练习",
    total: 2,
    questions: [
      {
        id: "question-1",
        levelId: "level-a",
        knowledgePointId: "kp-radio",
        stem: "无线电波在真空中的传播速度约为多少？",
        type: "SINGLE_CHOICE",
        optionCount: 4,
        correctOptionCount: 1,
        selectionSpec: "4选1",
        options: [
          { id: "A", text: "每秒三十万千米" },
          { id: "B", text: "每秒三万千米" },
          { id: "C", text: "每秒三千千米" },
          { id: "D", text: "取决于发射功率" },
        ],
        knowledgeName: "无线电基础",
        levelCode: "A",
      },
      {
        id: "question-2",
        levelId: "level-a",
        knowledgePointId: "kp-operation",
        stem: "下列哪些做法有助于减少业余电台干扰？",
        type: "MULTIPLE_CHOICE",
        optionCount: 4,
        correctOptionCount: 2,
        selectionSpec: "4选2",
        options: [
          { id: "A", text: "使用合适的发射功率" },
          { id: "B", text: "检查设备接地与滤波" },
          { id: "C", text: "持续占用频率" },
          { id: "D", text: "忽略邻频通信" },
        ],
        knowledgeName: "规范操作",
        levelCode: "A",
      },
    ],
    initialResults: {},
    ...overrides,
  };
}
