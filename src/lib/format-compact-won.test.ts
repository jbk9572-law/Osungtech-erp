import { describe, expect, it } from "vitest";
import { formatCompactWon } from "./format-compact-won";

describe("formatCompactWon", () => {
  it("단위별로 줄여 보여준다", () => {
    expect(formatCompactWon(850)).toBe("850");
    expect(formatCompactWon(3_240_000)).toBe("324만");
    expect(formatCompactWon(120_000_000)).toBe("1.2억");
  });
  it("음수는 부호를 유지한다", () => {
    expect(formatCompactWon(-3_240_000)).toBe("-324만");
  });
});
