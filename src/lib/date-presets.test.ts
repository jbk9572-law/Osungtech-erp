import { describe, expect, it } from "vitest";
import { currentMonth, getDatePresets, getMonthRange, shiftMonth } from "./date-presets";

// getDatePresets/currentMonth는 KST 변환을 거치므로, 한국 기준으로
// 날짜가 확실히 정오 근처인 UTC 시각을 기준시로 넣어 테스트 흔들림을 막는다.
function kstNoon(dateStr: string): Date {
  return new Date(`${dateStr}T03:00:00.000Z`); // KST 12:00
}

describe("getDatePresets", () => {
  it("수요일 기준으로 이번주는 월요일에 시작해 일요일에 끝난다", () => {
    // 2026-08-19는 수요일(KST)
    const presets = getDatePresets(kstNoon("2026-08-19"));
    const thisWeek = presets.find((p) => p.label === "이번주")!;
    expect(thisWeek.from).toBe("2026-08-17"); // 월요일
    expect(thisWeek.to).toBe("2026-08-23"); // 일요일
  });

  it("일요일 기준으로도 이번주는 그 주의 월요일부터 시작한다", () => {
    // 2026-08-23은 일요일(KST)
    const presets = getDatePresets(kstNoon("2026-08-23"));
    const thisWeek = presets.find((p) => p.label === "이번주")!;
    expect(thisWeek.from).toBe("2026-08-17");
    expect(thisWeek.to).toBe("2026-08-23");
  });

  it("지난주는 이번주보다 정확히 7일 앞선 구간이다", () => {
    const presets = getDatePresets(kstNoon("2026-08-19"));
    const lastWeek = presets.find((p) => p.label === "지난주")!;
    expect(lastWeek.from).toBe("2026-08-10");
    expect(lastWeek.to).toBe("2026-08-16");
  });

  it("1월에 지난달을 구하면 작년 12월로 넘어간다", () => {
    const presets = getDatePresets(kstNoon("2026-01-15"));
    const lastMonth = presets.find((p) => p.label === "지난달")!;
    expect(lastMonth.from).toBe("2025-12-01");
    expect(lastMonth.to).toBe("2025-12-31");
  });

  it("이번달은 그 달의 1일부터 말일까지다(2월 말일 포함)", () => {
    const presets = getDatePresets(kstNoon("2026-02-10"));
    const thisMonth = presets.find((p) => p.label === "이번달")!;
    expect(thisMonth.from).toBe("2026-02-01");
    expect(thisMonth.to).toBe("2026-02-28");
  });

  it("작년은 항상 올해보다 1년 앞선 1/1~12/31이다", () => {
    const presets = getDatePresets(kstNoon("2026-06-01"));
    const lastYear = presets.find((p) => p.label === "작년")!;
    expect(lastYear.from).toBe("2025-01-01");
    expect(lastYear.to).toBe("2025-12-31");
  });
});

describe("currentMonth", () => {
  it("KST 기준 YYYY-MM을 반환한다", () => {
    expect(currentMonth(kstNoon("2026-08-19"))).toBe("2026-08");
  });
});

describe("getMonthRange", () => {
  it("평년 2월은 28일까지다", () => {
    expect(getMonthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("윤년 2월은 29일까지다", () => {
    expect(getMonthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("12월은 31일까지다", () => {
    expect(getMonthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("shiftMonth", () => {
  it("양수만큼 뒤로 이동한다", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
  });

  it("음수만큼 앞으로 이동한다", () => {
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("12월에서 +1하면 다음 해 1월로 넘어간다", () => {
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });

  it("1월에서 -1하면 전 해 12월로 넘어간다", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
