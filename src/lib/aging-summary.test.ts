import { describe, expect, it } from "vitest";
import { buildAgingSummary } from "./aging-summary";
import type { BalanceRow } from "@/components/balance-grid-table";

const row = (balance: number, daysOverdue: number | null): BalanceRow => ({ balance, daysOverdue } as unknown as BalanceRow);

describe("buildAgingSummary", () => {
  it("초과 입금(마이너스 잔액)은 합계·거래처 수·구간에서 제외한다", () => {
    const s = buildAgingSummary([row(1_000_000, 100), row(-300_000, 0)]);
    expect(s.totalBalance).toBe(1_000_000);
    expect(s.partyCount).toBe(1);
    expect(s.buckets.find((b) => b.label === "정상")?.count).toBe(0);
    expect(s.buckets.find((b) => b.label === "90일+ 연체")?.amount).toBe(1_000_000);
  });
  it("빈 목록은 0", () => {
    const s = buildAgingSummary([]);
    expect([s.totalBalance, s.partyCount, s.avgBalance]).toEqual([0, 0, 0]);
  });
});
