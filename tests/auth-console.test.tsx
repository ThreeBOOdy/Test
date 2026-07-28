import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthConsole } from "@/components/auth-console";

describe("authentication console", () => {
  it("presents authentication as a secure receiver channel", () => {
    render(<AuthConsole title="接入训练频道" description="身份验证" callsign="AUTH / 10.140"><div>表单内容</div></AuthConsole>);

    expect(screen.getByRole("heading", { name: "接入训练频道" })).toBeInTheDocument();
    expect(screen.getByText("AUTH / 10.140")).toBeInTheDocument();
    expect(screen.getByText("表单内容")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /无线电测向/ })).toBeInTheDocument();
  });
});
