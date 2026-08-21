import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WrongClearButton } from "@/components/wrong-clear-button";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

describe("WrongClearButton", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.refresh.mockReset();
  });

  it("asks for confirmation before clearing", async () => {
    const user = userEvent.setup();
    render(<WrongClearButton apiPath="/api/v1/student/wrong/clear" count={3} />);

    await user.click(screen.getByRole("button", { name: "一键清除错题" }));

    expect(screen.getByRole("alertdialog", { name: "确认清除全部错题？" })).toBeInTheDocument();
    expect(screen.getByText(/将清除当前字母类下 3 道错题/)).toBeInTheDocument();
  });

  it("cancels without calling the clear API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<WrongClearButton apiPath="/api/v1/student/wrong/clear" count={1} />);

    await user.click(screen.getByRole("button", { name: "一键清除错题" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the clear API after confirmation and refreshes the page", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ cleared: 3, levelId: "level-a", levelCode: "A" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WrongClearButton apiPath="/api/v1/student/wrong/clear" count={3} />);

    await user.click(screen.getByRole("button", { name: "一键清除错题" }));
    await user.click(screen.getByRole("button", { name: "确认清除" }));

    expect(await screen.findByText(/错题已清除（3 道）/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/student/wrong/clear", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows the API error message when clearing is not allowed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "当前未开放学生自助清除错题，请联系老师" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WrongClearButton apiPath="/api/v1/student/wrong/clear" count={1} />);

    await user.click(screen.getByRole("button", { name: "一键清除错题" }));
    await user.click(screen.getByRole("button", { name: "确认清除" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("当前未开放学生自助清除错题，请联系老师");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
