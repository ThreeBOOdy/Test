import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeMapView } from "@/components/knowledge-map-view";
import type { PublicKnowledgeMap } from "@/lib/domain/knowledge-map";

const map: PublicKnowledgeMap = {
  mapEnabled: true,
  thresholds: { minAnswers: 3, accuracy: 80 },
  stats: { total: 2, mastered: 0, weak: 1, unvisited: 1 },
  nodes: [
    {
      id: "kp-1",
      code: "1",
      name: "无线电基础",
      parentId: null,
      path: "/1",
      depth: 0,
      sortOrder: 0,
      enabled: true,
      status: "weak",
      answered: 2,
      correct: 1,
      accuracy: 50,
      hasPractice: false,
      children: [
        {
          id: "kp-1-1",
          code: "1.1",
          name: "中继台",
          parentId: "kp-1",
          path: "/1/1",
          depth: 1,
          sortOrder: 0,
          enabled: true,
          status: "weak",
          answered: 2,
          correct: 1,
          accuracy: 50,
          hasPractice: true,
          practiceHref: "/student/practice/start?mode=knowledge&level=A&knowledge=kp-1-1",
          children: [],
        },
      ],
    },
  ],
};

describe("KnowledgeMapView", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the map tree with weak node dungeon links", () => {
    render(<KnowledgeMapView initial={map} />);
    expect(screen.getByRole("heading", { name: "知识点地图" })).toBeInTheDocument();
    expect(screen.getAllByText("待攻克").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /进入副本/ })).toHaveAttribute("href", "/student/practice/start?mode=knowledge&level=A&knowledge=kp-1-1");
  });

  it("hides and restores the home entry through the profile API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ mapEnabled: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<KnowledgeMapView initial={map} />);
    await user.click(screen.getByRole("button", { name: "隐藏首页入口" }));

    expect(await screen.findByRole("button", { name: "在首页显示入口" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/rpg/profile", expect.objectContaining({
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ mapEnabled: false }),
    }));
  });
});
