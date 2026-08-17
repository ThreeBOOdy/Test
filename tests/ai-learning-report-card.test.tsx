import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudentWeeklyReport } from "@/components/ai-student-weekly-report";
import { AiTeacherClassReport } from "@/components/ai-teacher-class-report";

const studentReport = {
  generatedAt: "2026-08-17T00:00:00.000Z",
  period: { start: "2026-08-10T00:00:00.000Z", end: "2026-08-17T00:00:00.000Z", label: "近 7 天" },
  summary: { completedSessions: 3, answered: 30, correct: 21, accuracy: 70, totalMinutes: 45 },
  weakPoints: [{ code: "1.2", name: "中继台频率", answered: 10, correct: 4, accuracy: 40 }],
  content: {
    summary: "本周表现稳定",
    weakPoints: ["中继台频率"],
    nextSteps: ["多做专项练习"],
    encouragement: "继续保持！",
  },
  disclaimer: "AI 生成，仅供参考",
  model: "mock-model",
};

const teacherReport = {
  generatedAt: "2026-08-17T00:00:00.000Z",
  period: { start: "2026-08-10T00:00:00.000Z", end: "2026-08-17T00:00:00.000Z", label: "近 7 天" },
  summary: { completedSessions: 12, activeStudents: 5, answered: 120, correct: 84, accuracy: 70 },
  weakPoints: [{ code: "1.2", name: "中继台频率", answered: 40, correct: 16, accuracy: 40 }],
  content: {
    overview: "班级整体正确率中等",
    weakPoints: ["中继台频率"],
    classFocus: ["重点讲解中继台频率"],
    suggestions: "增加专项练习",
  },
  disclaimer: "AI 生成，仅供参考",
  model: "mock-model",
};

describe("AI learning report cards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the student weekly report after loading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(studentReport), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    render(<AiStudentWeeklyReport />);

    expect(await screen.findByText("本周表现稳定")).toBeInTheDocument();
    expect(screen.getByText("中继台频率")).toBeInTheDocument();
    expect(screen.getByText("多做专项练习")).toBeInTheDocument();
    expect(screen.getByText("继续保持！")).toBeInTheDocument();
    expect(screen.getByText("AI 生成，仅供参考")).toBeInTheDocument();
    expect(screen.getByText("模型：mock-model")).toBeInTheDocument();
  });

  it("renders the teacher class report after loading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(teacherReport), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    render(<AiTeacherClassReport />);

    expect(await screen.findByText("班级整体正确率中等")).toBeInTheDocument();
    expect(screen.getByText("中继台频率")).toBeInTheDocument();
    expect(screen.getByText("重点讲解中继台频率")).toBeInTheDocument();
    expect(screen.getByText("增加专项练习")).toBeInTheDocument();
    expect(screen.getByText("AI 生成，仅供参考")).toBeInTheDocument();
  });

  it("shows an error state when the student report request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "生成周报失败" }), { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    render(<AiStudentWeeklyReport />);

    await waitFor(() => expect(screen.getByText("生成周报失败")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});
