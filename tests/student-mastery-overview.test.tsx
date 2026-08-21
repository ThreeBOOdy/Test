import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StudentMasteryOverview } from "@/components/student-mastery-overview";
import type { StudentMasteryOverview as StudentMasteryOverviewType } from "@/lib/domain/learning-state";

const overview: StudentMasteryOverviewType = {
  levelId: "level-a",
  levelCode: "A",
  levelName: "A级",
  total: 10,
  notStarted: 4,
  learning: 2,
  due: 1,
  mastered: 3,
};

describe("StudentMasteryOverview", () => {
  it("renders the active-level mastery counts", () => {
    render(<StudentMasteryOverview overview={overview} />);

    expect(screen.getByText("当前掌握概览")).toBeInTheDocument();
    expect(screen.getByText("当前字母类 A · 共 10 题")).toBeInTheDocument();
    expect(screen.getByText("未做")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("待复习")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("学习中")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("已掌握")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
