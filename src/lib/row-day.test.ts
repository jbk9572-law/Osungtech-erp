import { describe, expect, it } from "vitest";
import { rowDay, rowDayClass } from "./row-day";

describe("rowDay", () => {
  it("오늘/미래/과거/빈값을 구분한다", () => {
    expect(rowDay("2026-11-12", "2026-11-12")).toBe("today");
    expect(rowDay("2026-11-12T00:00:00", "2026-11-12")).toBe("today");
    expect(rowDay("2026-11-15", "2026-11-12")).toBe("future");
    expect(rowDay("2026-11-11", "2026-11-12")).toBeNull();
    expect(rowDay(null, "2026-11-12")).toBeNull();
  });
  it("className 접미사", () => {
    expect(rowDayClass("today")).toBe(" day-today");
    expect(rowDayClass(null)).toBe("");
  });
});
