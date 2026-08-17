import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GradeGamificationSettings } from "@/components/grade-gamification-settings";

describe("GradeGamificationSettings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders grade gamification toggles", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      grades: [
        { id: "grade-1", code: "JUNIOR_1", name: "一年级", studentCount: 3, gamificationEnabled: true },
        { id: "grade-2", code: "JUNIOR_2", name: "二年级", studentCount: 0, gamificationEnabled: false },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GradeGamificationSettings />);

    expect(await screen.findByText("一年级")).toBeInTheDocument();
    expect(screen.getByText("二年级")).toBeInTheDocument();
    expect(screen.getByText("3 名学生")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "隐藏" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/grades", expect.objectContaining({ credentials: "include" }));
  });

  it("toggles a grade off and refreshes the row", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/gamification")) {
        return new Response(JSON.stringify({ id: "grade-1", code: "JUNIOR_1", name: "一年级", studentCount: 3, gamificationEnabled: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        grades: [{ id: "grade-1", code: "JUNIOR_1", name: "一年级", studentCount: 3, gamificationEnabled: true }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GradeGamificationSettings />);
    await screen.findByText("一年级");
    await user.click(screen.getByRole("button", { name: "隐藏" }));

    expect(await screen.findByText("隐藏游戏化")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/grades/grade-1/gamification", expect.objectContaining({
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ enabled: false }),
    }));
  });
});
