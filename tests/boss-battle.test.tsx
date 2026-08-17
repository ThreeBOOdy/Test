import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BossBattle } from "@/components/training/boss-battle";

describe("BossBattle", () => {
  it("shows the boss HP bar and pass line during an exam", () => {
    render(<BossBattle mode="exam" total={10} passingCount={5} />);
    expect(screen.getByText("Boss 血条")).toBeInTheDocument();
    expect(screen.getByText("通关需正确率 ≥ 50%")).toBeInTheDocument();
    expect(screen.getByText("当前 HP 100%")).toBeInTheDocument();
  });

  it("shows a defeated boss when the final accuracy reaches the pass line", () => {
    render(<BossBattle mode="result" total={10} correct={8} passingCount={5} />);
    expect(screen.getByText("Boss 已被击败")).toBeInTheDocument();
    expect(screen.getByText("造成 80% 伤害 · 剩余 20%")).toBeInTheDocument();
  });

  it("shows a surviving boss when the final accuracy is below the pass line", () => {
    render(<BossBattle mode="result" total={10} correct={4} passingCount={5} />);
    expect(screen.getByText("Boss 未被击败")).toBeInTheDocument();
    expect(screen.getByText("造成 40% 伤害 · 剩余 60%")).toBeInTheDocument();
  });
});
