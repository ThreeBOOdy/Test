import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StudentExplanationCard } from "@/components/student-explanation-card";

describe("StudentExplanationCard", () => {
  it("shows a friendly placeholder when no approved explanation exists", () => {
    render(<StudentExplanationCard explanation={null} />);
    expect(screen.getByText("老师正在补充解析，请稍后再来看看。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看解析" })).not.toBeInTheDocument();
  });

  it("auto-expands the explanation when the student answered incorrectly", () => {
    render(
      <StudentExplanationCard
        autoExpand
        explanation={{ summary: "选 B 是因为中继台下行频率需避开航空业务。", knowledge: "中继台频率规划需要避开航空移动业务。", memory: "航空优先，中继让路。" }}
      />,
    );
    expect(screen.getByRole("button", { name: "收起解析" })).toBeInTheDocument();
    expect(screen.getByText("一句话解析")).toBeInTheDocument();
    expect(screen.getByText("选 B 是因为中继台下行频率需避开航空业务。")).toBeInTheDocument();
    expect(screen.getByText("知识点讲解")).toBeInTheDocument();
    expect(screen.getByText("记忆点")).toBeInTheDocument();
  });

  it("keeps the explanation collapsed by default and toggles on click", async () => {
    const user = userEvent.setup();
    render(<StudentExplanationCard explanation={{ summary: "一句话", knowledge: "讲解", memory: "口诀" }} />);
    const toggle = screen.getByRole("button", { name: "查看解析" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("一句话解析")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "收起解析" })).toBeInTheDocument();
    expect(screen.getByText("一句话解析")).toBeInTheDocument();
    expect(screen.getByText("讲解")).toBeInTheDocument();
    expect(screen.getByText("口诀")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "收起解析" }));
    expect(screen.getByRole("button", { name: "查看解析" })).toBeInTheDocument();
    expect(screen.queryByText("一句话解析")).not.toBeInTheDocument();
  });
});
