import { describe, expect, it } from "vitest";
import { consumeOldestFirst, daysSince } from "./ar-ap";

describe("daysSince", () => {
  it("같은 날짜면 0을 반환한다", () => {
    expect(daysSince("2026-08-15", "2026-08-15")).toBe(0);
  });

  it("과거 날짜와의 일수 차이를 계산한다", () => {
    expect(daysSince("2026-08-01", "2026-08-15")).toBe(14);
  });

  it("미래 날짜(음수 결과)는 0으로 내려간다", () => {
    expect(daysSince("2026-08-20", "2026-08-15")).toBe(0);
  });
});

describe("consumeOldestFirst — 수금/지급을 오래된 전표부터 상계", () => {
  const orders = [
    { id: "a", date: "2026-08-01", total: 1000 },
    { id: "b", date: "2026-08-05", total: 2000 },
    { id: "c", date: "2026-08-10", total: 3000 },
  ];

  it("입금액이 0이면 모든 전표가 미결제로 남는다", () => {
    const result = consumeOldestFirst(orders, 0, "2026-08-15");
    expect(result.map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(result[0].outstanding).toBe(1000);
    expect(result[0].daysOverdue).toBe(14);
  });

  it("입금액이 가장 오래된 전표를 정확히 채우면 그 전표만 사라진다", () => {
    const result = consumeOldestFirst(orders, 1000, "2026-08-15");
    expect(result.map((o) => o.id)).toEqual(["b", "c"]);
    expect(result[0].outstanding).toBe(2000);
  });

  it("입금액이 전표 중간에서 끊기면 그 전표는 일부만 남고 이후 전표는 전액 남는다", () => {
    const result = consumeOldestFirst(orders, 1500, "2026-08-15");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "b", outstanding: 1500 });
    expect(result[1]).toMatchObject({ id: "c", outstanding: 3000 });
  });

  it("입금액이 전체 합계 이상이면 미결제 전표가 없다", () => {
    const result = consumeOldestFirst(orders, 6000, "2026-08-15");
    expect(result).toEqual([]);
  });

  it("전표가 없으면 빈 배열을 반환한다", () => {
    expect(consumeOldestFirst([], 1000, "2026-08-15")).toEqual([]);
  });
});
