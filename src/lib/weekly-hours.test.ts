import { describe, expect, it } from "vitest";
import { getWeekRange, sumWorkedHours, weeklyHoursTone } from "./weekly-hours";

describe("getWeekRange", () => {
  it("수요일이면 그 주의 월~일로 맞춘다", () => {
    // 2026-09-23은 수요일
    expect(getWeekRange("2026-09-23")).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });

  it("월요일 자신은 그 주의 시작이다", () => {
    expect(getWeekRange("2026-09-21")).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });

  it("일요일은 그 전주 월요일부터 시작한다", () => {
    expect(getWeekRange("2026-09-27")).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });

  it("월이 걸쳐도 정확히 계산한다", () => {
    // 2026-10-01은 목요일 -> 그 주 월요일은 2026-09-28
    expect(getWeekRange("2026-10-01")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
  });
});

describe("sumWorkedHours", () => {
  it("출퇴근이 둘 다 있는 기록만 더한다", () => {
    const hours = sumWorkedHours([
      { clock_in_at: "2026-09-21T00:00:00Z", clock_out_at: "2026-09-21T09:00:00Z" }, // 9h
      { clock_in_at: "2026-09-22T00:00:00Z", clock_out_at: null }, // 진행중 - 제외
      { clock_in_at: "2026-09-23T00:00:00Z", clock_out_at: "2026-09-23T08:30:00Z" }, // 8.5h
    ]);
    expect(hours).toBe(17.5);
  });

  it("기록이 없으면 0", () => {
    expect(sumWorkedHours([])).toBe(0);
  });
});

describe("weeklyHoursTone", () => {
  it("48시간 미만은 정상", () => {
    expect(weeklyHoursTone(47.9)).toBe("ok");
  });

  it("48시간 이상 52시간 이하는 경고", () => {
    expect(weeklyHoursTone(48)).toBe("warn");
    expect(weeklyHoursTone(52)).toBe("warn");
  });

  it("52시간 초과는 위험", () => {
    expect(weeklyHoursTone(52.1)).toBe("danger");
  });
});
