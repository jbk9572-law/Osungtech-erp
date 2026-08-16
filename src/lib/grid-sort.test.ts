import { describe, expect, it } from "vitest";
import { compareSortValues, nextSortState } from "./grid-sort";

describe("nextSortState", () => {
  it("처음 누르면 오름차순(dir=1)으로 시작한다", () => {
    expect(nextSortState(null, "name")).toEqual({ key: "name", dir: 1 });
  });

  it("오름차순 상태에서 같은 컬럼을 다시 누르면 내림차순으로 바뀐다", () => {
    expect(nextSortState({ key: "name", dir: 1 }, "name")).toEqual({ key: "name", dir: -1 });
  });

  it("내림차순 상태에서 같은 컬럼을 또 누르면 정렬이 해제된다", () => {
    expect(nextSortState({ key: "name", dir: -1 }, "name")).toBeNull();
  });

  it("다른 컬럼을 누르면 이전 정렬은 버리고 새 컬럼 오름차순으로 시작한다", () => {
    expect(nextSortState({ key: "name", dir: -1 }, "amount")).toEqual({ key: "amount", dir: 1 });
  });
});

describe("compareSortValues", () => {
  it("둘 다 숫자면 산술 차로 비교한다", () => {
    expect(compareSortValues(1, 2)).toBeLessThan(0);
    expect(compareSortValues(5, 5)).toBe(0);
    expect(compareSortValues(9, 3)).toBeGreaterThan(0);
  });

  it("문자열은 한국어 로케일 기준으로 비교한다", () => {
    expect(compareSortValues("가", "나")).toBeLessThan(0);
  });

  it("null/undefined는 빈 문자열처럼 취급해 항상 먼저 온다", () => {
    expect(compareSortValues(null, "가")).toBeLessThan(0);
    expect(compareSortValues(undefined, "가")).toBeLessThan(0);
  });

  it("숫자와 문자가 섞이면 문자열 비교로 폴백한다(사전식이라 10이 9보다 앞에 온다)", () => {
    // typeof 검사가 둘 다 number일 때만 산술 비교를 타므로, 하나라도
    // 문자열이면 String() 변환 후 localeCompare로 비교한다 — 즉 "10"과
    // "9"는 크기가 아니라 앞자리 문자('1' < '9')로 비교된다.
    expect(compareSortValues(10, "9")).toBeLessThan(0);
  });
});
