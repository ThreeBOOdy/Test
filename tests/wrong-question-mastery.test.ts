import { describe, expect, it } from "vitest";
import { advanceWrongQuestionMastery } from "@/lib/domain/wrong-question-mastery";

const initial = { correctSessionCount: 0, mastered: false, lastCountedSessionId: null };

describe("wrong question mastery", () => {
  it("requires three different settled sessions to master", () => {
    const first = advanceWrongQuestionMastery(initial, "CORRECT", "session-1");
    const second = advanceWrongQuestionMastery(first, "CORRECT", "session-2");
    const third = advanceWrongQuestionMastery(second, "CORRECT", "session-3");

    expect(first.correctSessionCount).toBe(1);
    expect(second.correctSessionCount).toBe(2);
    expect(third).toEqual({ correctSessionCount: 3, mastered: true, lastCountedSessionId: "session-3" });
  });

  it("does not count retries in the same session", () => {
    const first = advanceWrongQuestionMastery(initial, "CORRECT", "session-1");
    expect(advanceWrongQuestionMastery(first, "CORRECT", "session-1")).toEqual(first);
  });

  it("resets the streak on a wrong answer", () => {
    const first = advanceWrongQuestionMastery(initial, "CORRECT", "session-1");
    const second = advanceWrongQuestionMastery(first, "CORRECT", "session-2");
    expect(advanceWrongQuestionMastery(second, "WRONG", "session-3")).toEqual({ correctSessionCount: 0, mastered: false, lastCountedSessionId: "session-3" });
  });
});
