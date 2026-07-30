import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RadioPersonManager } from "@/components/radio-person-manager";

const people = [{ id: "radio-person-001", username: "radio-001", name: "贡献者一", profile: "人物资料", resourceStatus: "AVAILABLE" as const, statusNote: null, student: { id: "student-1", username: "radio-001", realName: "张三", displayName: "张三" } }];

describe("radio person manager", () => {
  it("shows the bound identity and limits its maintenance to resource settings", async () => {
    const user = userEvent.setup();
    render(<RadioPersonManager initialPeople={people} />);

    expect(screen.getByText("张三 · radio-001")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "维护" }));
    expect(screen.getByLabelText("人物用户名")).toBeDisabled();
    expect(screen.getByLabelText("人物名称")).toBeDisabled();
    expect(screen.getByLabelText("人物资料")).toBeDisabled();
    expect(screen.getByLabelText("资源状态")).toBeEnabled();
  });
});