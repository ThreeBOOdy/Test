import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProvider } from "@/lib/server/ai/provider";

const mocks = vi.hoisted(() => ({
  aiUsageLogCreate: vi.fn(),
  getStudentLearningStatistics: vi.fn(),
  getTeacherLearningStatistics: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    aiUsageLog: { create: mocks.aiUsageLogCreate },
  },
}));

vi.mock("@/lib/server/learning-statistics-service", () => ({
  getStudentLearningStatistics: mocks.getStudentLearningStatistics,
  getTeacherLearningStatistics: mocks.getTeacherLearningStatistics,
}));

import {
  AI_DISCLAIMER,
  STUDENT_WEEKLY_REPORT_ACTION,
  TEACHER_CLASS_REPORT_ACTION,
  buildStudentWeeklyReportPrompt,
  buildTeacherClassReportPrompt,
  generateStudentWeeklyReport,
  generateTeacherClassReport,
  parseStudentReportResponse,
  parseTeacherReportResponse,
} from "@/lib/server/ai/report";

const studentStats = {
  summary: { completedSessions: 3, answered: 30, correct: 21, accuracy: 70, totalMinutes: 45 },
  knowledgePoints: [{ code: "1.2", name: "中继台频率", answered: 10, correct: 4, accuracy: 40 }],
};

const teacherStats = {
  summary: { completedSessions: 12, activeStudents: 5, answered: 120, correct: 84, accuracy: 70 },
  knowledgePoints: [{ code: "1.2", name: "中继台频率", answered: 40, correct: 16, accuracy: 40 }],
  students: [{ displayName: "张三", completedSessions: 2, answered: 20, correct: 10, accuracy: 50 }],
};

describe("AI learning report prompts", () => {
  it("builds a student weekly report prompt from real statistics", () => {
    const messages = buildStudentWeeklyReportPrompt(studentStats);
    const user = messages.find((message) => message.role === "user")?.content ?? "";

    expect(user).toContain("本周完成练习：3 次");
    expect(user).toContain("本周正确率：70%");
    expect(user).toContain("中继台频率");
    expect(user).toContain('"encouragement"');
  });

  it("builds a teacher class report prompt without student names", () => {
    const messages = buildTeacherClassReportPrompt(teacherStats);
    const user = messages.find((message) => message.role === "user")?.content ?? "";

    expect(user).toContain("班级完成练习：12 次");
    expect(user).toContain("活跃学生：5 人");
    expect(user).toContain("中继台频率");
    expect(user).not.toContain("张三");
    expect(user).not.toContain("displayName");
  });
});

describe("parse learning report responses", () => {
  it("parses a structured student weekly report", () => {
    const content = JSON.stringify({
      summary: "本周表现稳定",
      weakPoints: ["中继台频率"],
      nextSteps: ["多做专项练习", "巩固错题"],
      encouragement: "继续保持！",
    });

    expect(parseStudentReportResponse(content)).toEqual({
      summary: "本周表现稳定",
      weakPoints: ["中继台频率"],
      nextSteps: ["多做专项练习", "巩固错题"],
      encouragement: "继续保持！",
    });
  });

  it("falls back to plain text for student reports", () => {
    expect(parseStudentReportResponse("Mock AI 响应")).toEqual({
      summary: "Mock AI 响应",
      weakPoints: [],
      nextSteps: [],
      encouragement: "",
    });
  });

  it("parses a structured teacher class report", () => {
    const content = JSON.stringify({
      overview: "班级整体正确率中等",
      weakPoints: ["中继台频率"],
      classFocus: ["重点讲解中继台频率"],
      suggestions: "增加专项练习",
    });

    expect(parseTeacherReportResponse(content)).toEqual({
      overview: "班级整体正确率中等",
      weakPoints: ["中继台频率"],
      classFocus: ["重点讲解中继台频率"],
      suggestions: "增加专项练习",
    });
  });

  it("falls back to plain text for teacher reports", () => {
    expect(parseTeacherReportResponse("Mock AI 响应")).toEqual({
      overview: "Mock AI 响应",
      weakPoints: [],
      classFocus: [],
      suggestions: "",
    });
  });
});

describe("generate AI learning reports", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.aiUsageLogCreate.mockResolvedValue({ id: "log-1" });
    mocks.getStudentLearningStatistics.mockResolvedValue(studentStats);
    mocks.getTeacherLearningStatistics.mockResolvedValue(teacherStats);
  });

  it("generates a student weekly report and records usage", async () => {
    const provider = new MockProvider({
      content: JSON.stringify({
        summary: "本周表现稳定",
        weakPoints: ["中继台频率"],
        nextSteps: ["多做专项练习"],
        encouragement: "继续保持！",
      }),
      model: "mock-model",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const result = await generateStudentWeeklyReport("user-1", {
      provider,
      now: new Date("2026-08-17T00:00:00.000Z"),
      since: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(mocks.getStudentLearningStatistics).toHaveBeenCalledWith("user-1", new Date("2026-08-10T00:00:00.000Z"));
    expect(result).toMatchObject({
      period: { start: "2026-08-10T00:00:00.000Z", end: "2026-08-17T00:00:00.000Z", label: "近 7 天" },
      summary: studentStats.summary,
      weakPoints: studentStats.knowledgePoints,
      content: {
        summary: "本周表现稳定",
        weakPoints: ["中继台频率"],
        nextSteps: ["多做专项练习"],
        encouragement: "继续保持！",
      },
      disclaimer: AI_DISCLAIMER,
      model: "mock-model",
    });
    expect(mocks.aiUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: STUDENT_WEEKLY_REPORT_ACTION,
        provider: "mock",
        model: "mock-model",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        latencyMs: expect.any(Number),
        requestHash: expect.any(String),
      }),
    });
  });

  it("generates a teacher class report and records usage", async () => {
    const provider = new MockProvider({
      content: JSON.stringify({
        overview: "班级整体正确率中等",
        weakPoints: ["中继台频率"],
        classFocus: ["重点讲解中继台频率"],
        suggestions: "增加专项练习",
      }),
      model: "mock-model",
      usage: { promptTokens: 11, completionTokens: 22, totalTokens: 33 },
    });

    const result = await generateTeacherClassReport("teacher-1", {
      provider,
      now: new Date("2026-08-17T00:00:00.000Z"),
      since: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(mocks.getTeacherLearningStatistics).toHaveBeenCalledWith(new Date("2026-08-10T00:00:00.000Z"));
    expect(result).toMatchObject({
      summary: teacherStats.summary,
      weakPoints: teacherStats.knowledgePoints,
      content: {
        overview: "班级整体正确率中等",
        weakPoints: ["中继台频率"],
        classFocus: ["重点讲解中继台频率"],
        suggestions: "增加专项练习",
      },
      disclaimer: AI_DISCLAIMER,
      model: "mock-model",
    });
    expect(mocks.aiUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "teacher-1",
        action: TEACHER_CLASS_REPORT_ACTION,
        provider: "mock",
        model: "mock-model",
        promptTokens: 11,
        completionTokens: 22,
        totalTokens: 33,
        latencyMs: expect.any(Number),
        requestHash: expect.any(String),
      }),
    });
  });
});
