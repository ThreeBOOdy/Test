import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GradeWrongClearSettings } from "@/components/grade-wrong-clear-settings";

describe("GradeWrongClearSettings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders per-grade self-service clear toggles", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      grades: [
        { id: "grade-1", code: "JUNIOR_1", name: "一年级", studentCount: 3, studentSelfWrongClearEnabled: false },
        { id: "grade-2", code: "JUNIOR_2", name: "二年级", studentCount: 0, studentSelfWrongClearEnabled: true },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GradeWrongClearSettings />);

    expect(await screen.findByText("一年级")).toBeInTheDocument();
    expect(screen.getByText("二年级")).toBeInTheDocument();
    expect(screen.getByText("3 名学生")).toBeInTheDocument();
    expect(screen.getByText("仅教师可清除")).toBeInTheDocument();
    expect(screen.getByText("已开放自助清除")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/grades", expect.objectContaining({ credentials: "include" }));
  });

  it("enables a grade and refreshes the row", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/wrong-clear")) {
        return new Response(JSON.stringify({ id: "grade-1", code: "JUNIOR_1", name: "一年级", studentCount: 3, studentSelfWrongClearEnabled: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        grades: [{ id: "grade-1", code: "JUNIOR_1", name: "一年级", studentCount: 3, studentSelfWrongClearEnabled: false }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GradeWrongClearSettings />);
    await screen.findByText("一年级");
    await user.click(screen.getByRole("button", { name: "开启自助清除" }));

    expect(await screen.findByText("已开放自助清除")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/grades/grade-1/wrong-clear", expect.objectContaining({
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ enabled: true }),
    }));
  });
});
