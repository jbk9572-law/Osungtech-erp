import type { BalanceRow } from "@/components/balance-grid-table";
import type { AgingBucket } from "@/components/erp/aging-distribution-bar";

// 미수금현황/미지급금현황이 똑같은 "KPI 타일 4개 + 연체 구간별 분포" 요약을
// 쓰는데, 처음에 미수금현황만 만들면서 이 집계를 페이지 파일 안에 직접
// 넣었다가 미지급금현황을 나중에 맞추려니 그대로 복붙해야 하는 상황이
// 됐다(사용자 지적 — "미수금이랑 미지급금 양식을 맞춰야지") — 둘이 다시
// 벌어지지 않게 공용 함수로 뺀다.
export type AgingSummary = {
  totalBalance: number;
  partyCount: number;
  avgBalance: number;
  maxDaysOverdue: number;
  buckets: AgingBucket[];
};

export function buildAgingSummary(allRows: BalanceRow[]): AgingSummary {
  // 초과 입금(잔액이 마이너스인 거래처)은 "받을 돈"이 아니므로 합계·거래처 수·연체 구간에서 뺀다 —
  // 대시보드의 미수 합계(sumOutstandingBalance)와 같은 기준. 목록에는 그대로 보여 준다.
  const rows = allRows.filter((r) => r.balance > 0);
  const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
  const partyCount = rows.length;
  const avgBalance = partyCount > 0 ? totalBalance / partyCount : 0;
  const maxDaysOverdue = rows.reduce((max, r) => Math.max(max, r.daysOverdue ?? 0), 0);

  const bucketStats = (match: (daysOverdue: number) => boolean) => {
    const matched = rows.filter((r) => match(r.daysOverdue ?? 0));
    return { count: matched.length, amount: matched.reduce((sum, r) => sum + r.balance, 0) };
  };

  return {
    totalBalance,
    partyCount,
    avgBalance,
    maxDaysOverdue,
    buckets: [
      { label: "정상", tone: "ok", ...bucketStats((d) => d <= 0) },
      { label: "1~89일 연체", tone: "warn", ...bucketStats((d) => d > 0 && d < 90) },
      { label: "90일+ 연체", tone: "danger", ...bucketStats((d) => d >= 90) },
    ],
  };
}
