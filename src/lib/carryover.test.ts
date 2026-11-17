import { describe, expect, it } from "vitest";
import { carryoverRowClass, nextMonthLabel } from "./carryover";

describe("carryoverRowClass", () => {
  it("이월이 아니면 색을 입히지 않는다", () => {
    expect(carryoverRowClass(false, false)).toBe("");
    expect(carryoverRowClass(undefined, true)).toBe("");
  });
  it("전월 이월분 구간은 호박색, 목록 안의 익월이월은 연보라로 구분한다", () => {
    expect(carryoverRowClass(true, true)).toBe(" row-carryover");
    expect(carryoverRowClass(true, false)).toBe(" row-carryover-next");
  });
});

describe("nextMonthLabel(익월이월 뱃지 글자 '12월 실적')", () => {
  it("다음 달 번호를 돌려주고, 12월이면 1월로 넘어간다", () => {
    expect(nextMonthLabel("2026-11-14")).toBe("12월");
    expect(nextMonthLabel("2026-12-30")).toBe("1월");
    expect(nextMonthLabel("잘못된 값")).toBe("다음달");
  });
});

import { formatCarryoverDate, usesShortDate } from "./carryover";

describe("이월건 날짜 표기 규칙", () => {
  it("올해 날짜는 MM.DD, 올해가 아니면 YY.MM.DD(연도 헷갈림 방지)", () => {
    expect(formatCarryoverDate("2026-10-30", "2026-11-17")).toBe("10.30");
    expect(formatCarryoverDate("2025-12-30", "2026-01-05")).toBe("25.12.30"); // 1월에 보는 전월이월분
    expect(formatCarryoverDate("이상한 값", "2026-11-17")).toBe("이상한 값");
  });
  it("뱃지가 붙는 행(이월·예약)은 짧은 날짜, 일반 행은 긴 날짜", () => {
    expect(usesShortDate({ compactSection: true, isCarryover: true, isFuture: false })).toBe(true);
    expect(usesShortDate({ compactSection: false, isCarryover: true, isFuture: false })).toBe(true); // 다음 달로 넘기는 이월
    expect(usesShortDate({ compactSection: false, isCarryover: false, isFuture: true })).toBe(true); // 예약
    expect(usesShortDate({ compactSection: false, isCarryover: false, isFuture: false })).toBe(false);
  });
});
