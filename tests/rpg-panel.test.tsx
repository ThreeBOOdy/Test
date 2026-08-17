import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RpgPanel } from "@/components/rpg-panel";
import type { PublicPlayerStatus } from "@/lib/domain/rpg";

const quest: PublicPlayerStatus["todayQuests"][number] = {
  id: "quest-practice",
  questDate: "2026-08-18",
  type: "PRACTICE",
  title: "今日刷题",
  description: "在完成的练习中累计答完题目",
  target: 20,
  progress: 20,
  status: "IN_PROGRESS",
  ready: true,
  xpReward: 50,
  completedAt: null,
};

const initial: PublicPlayerStatus = {
  xp: 0,
  level: 1,
  title: "见习报务员",
  currentLevelXp: 0,
  nextLevelXp: 80,
  levelProgress: 0,
  gamificationEnabled: true,
  mapEnabled: true,
  todayQuests: [quest],
};

const completedStatus: PublicPlayerStatus = {
  ...initial,
  xp: 50,
  levelProgress: 62,
  todayQuests: [{ ...quest, status: "COMPLETED", ready: false, completedAt: "2026-08-18T12:00:00.000Z" }],
};

const disabledStatus: PublicPlayerStatus = {
  ...initial,
  gamificationEnabled: false,
};

describe("RpgPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders player level, XP and today quests", () => {
    render(<RpgPanel initial={initial} />);
    expect(screen.getByText("Lv.1 · 见习报务员")).toBeInTheDocument();
    expect(screen.getByText("今日刷题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "领取奖励" })).toBeInTheDocument();
  });

  it("claims a completed quest and refreshes the status", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/complete")) {
        return new Response(JSON.stringify({ ...quest, status: "COMPLETED", ready: false, completedAt: "2026-08-18T12:00:00.000Z" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/v1/rpg/status")) {
        return new Response(JSON.stringify(completedStatus), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RpgPanel initial={initial} />);
    await user.click(screen.getByRole("button", { name: "领取奖励" }));

    expect(await screen.findByText("任务完成，获得 +50 XP")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/rpg/quests/quest-practice/complete", expect.objectContaining({ method: "POST", credentials: "include" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/rpg/status", expect.objectContaining({ credentials: "include", cache: "no-store" }));
  });

  it("toggles gamification off and refreshes the status", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/rpg/profile")) {
        return new Response(JSON.stringify(disabledStatus), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/v1/rpg/status")) {
        return new Response(JSON.stringify(disabledStatus), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RpgPanel initial={initial} />);
    await user.click(screen.getByRole("button", { name: "关闭游戏化" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("游戏化已关闭");
    expect(screen.getByRole("button", { name: "开启游戏化" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/rpg/profile", expect.objectContaining({
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ gamificationEnabled: false }),
    }));
  });
});
