import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiDailyEncouragement } from "@/components/ai-daily-encouragement";
import { AiMilestoneFeedback } from "@/components/ai-milestone-feedback";

describe("AI gamification components", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders daily encouragement from the API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      text: "今天也稳稳前进！",
      model: "mock-model",
      generatedAt: "2026-08-18T12:00:00.000Z",
      disclaimer: "AI 生成，仅供参考",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AiDailyEncouragement />);

    expect(await screen.findByText("今天也稳稳前进！")).toBeInTheDocument();
    expect(screen.getByText("AI 生成，仅供参考")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/ai/encouragement", expect.objectContaining({ credentials: "include" }));
  });

  it("renders fallback encouragement when the API fails", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "down" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AiDailyEncouragement />);

    expect(await screen.findByText("今天也保持稳定输出，把每个知识点都变成自己的信号。")).toBeInTheDocument();
  });

  it("posts a milestone event and renders feedback", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      text: "干得漂亮！",
      model: "mock-model",
      generatedAt: "2026-08-18T12:00:00.000Z",
      disclaimer: "AI 生成，仅供参考",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AiMilestoneFeedback event={{ type: "QUEST_COMPLETE", questTitle: "今日刷题", xpReward: 50 }} />);

    expect(await screen.findByText("干得漂亮！")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/ai/milestone-feedback", expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ type: "QUEST_COMPLETE", questTitle: "今日刷题", xpReward: 50 }),
    }));
  });
});
