import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { QuestionRichText } from "@/components/question-rich-text";

describe("QuestionRichText", () => {
  it("renders pure text unchanged without any images", () => {
    const { container } = render(<QuestionRichText text="这是一道纯文本题" />);
    expect(screen.getByText("这是一道纯文本题")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders a single image marker as an image between text", () => {
    const { container } = render(<QuestionRichText text="请看图[图:qimg_1]后作答" />);
    expect(screen.getByText("请看图")).toBeInTheDocument();
    expect(screen.getByText("后作答")).toBeInTheDocument();
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/api/v1/question-images/qimg_1");
    expect(image).toHaveAttribute("alt", "题目图片");
  });

  it("renders multiple mixed image markers in document order", () => {
    const { container } = render(<QuestionRichText text="前[图:qimg_1][图:qimg_2]中[图:qimg_3]后" />);
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(3);
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "/api/v1/question-images/qimg_1",
      "/api/v1/question-images/qimg_2",
      "/api/v1/question-images/qimg_3",
    ]);
    expect(container.textContent).toContain("前");
    expect(container.textContent).toContain("中");
    expect(container.textContent).toContain("后");
  });

  it("keeps bracket text that is not a question image marker literal", () => {
    const { container } = render(<QuestionRichText text="[图:abc] [普通括号] 保留" />);
    expect(screen.getByText("[图:abc] [普通括号] 保留")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("preserves line breaks for multi-line content", () => {
    const { container } = render(<QuestionRichText text={"第一行\n第二行"} />);
    expect(container.textContent).toContain("第一行\n第二行");
  });

  it("opens a fullscreen viewer when a zoomable image is clicked and closes on a second click", async () => {
    const user = userEvent.setup();
    render(<QuestionRichText text="[图:qimg_1]" zoomable />);
    await user.click(screen.getByRole("img", { name: "题目图片" }));
    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
    await user.click(screen.getByRole("img", { name: "题目图片放大查看" }));
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();
  });

  it("closes the viewer via the close button and the Escape key", async () => {
    const user = userEvent.setup();
    render(<QuestionRichText text="[图:qimg_1]" zoomable />);
    await user.click(screen.getByRole("img", { name: "题目图片" }));
    await user.click(screen.getByRole("button", { name: "关闭图片" }));
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("img", { name: "题目图片" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();
  });

  it("does not open a viewer when zoomable is false", async () => {
    const user = userEvent.setup();
    render(<QuestionRichText text="[图:qimg_1]" />);
    await user.click(screen.getByRole("img", { name: "题目图片" }));
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();
  });
});
