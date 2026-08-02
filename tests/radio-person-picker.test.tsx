import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RadioPersonPicker } from "@/components/radio-person-picker";

const people = Array.from({ length: 9 }, (_, index) => {
  const sequence = String(index + 1).padStart(3, "0");
  return { id: `radio-person-${sequence}`, username: `radio-${sequence}`, name: `人物${index + 1}`, profile: `人物${index + 1}的资料` };
});

function Wrapper() {
  const [selected, setSelected] = useState("");
  return <RadioPersonPicker people={people} value={selected} onChange={setSelected} />;
}

describe("RadioPersonPicker", () => {
  it("shows at most four identities per page with random order and page indicator", async () => {
    render(<Wrapper />);
    expect(await screen.findAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText(/共 9 位 · 第 1 \/ 3 页/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();
  });

  it("navigates forward and back through pages", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await screen.findAllByRole("radio");

    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findAllByRole("radio")).toHaveLength(1);
    expect(screen.getByText(/第 3 \/ 3 页/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "上一页" }));
    expect(await screen.findAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();
  });

  it("keeps the selection when navigating to another page and back", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const radios = await screen.findAllByRole("radio");
    await user.click(radios[0]);
    expect(radios[0]).toBeChecked();

    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect((await screen.findAllByRole("radio")).filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "上一页" }));
    expect((await screen.findAllByRole("radio")).filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
  });

  it("shows an empty message when no identities are available", () => {
    render(<RadioPersonPicker people={[]} value="" onChange={() => undefined} />);
    expect(screen.getByText("暂无可选人物身份，请联系管理员维护目录。")).toBeInTheDocument();
  });
});
