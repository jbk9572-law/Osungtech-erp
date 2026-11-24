import { buildAgingSummary } from "@/lib/aging-summary";
import type { BalanceRow } from "@/components/balance-grid-table";
import { BalanceSummaryView } from "@/components/erp/balance-summary-view";

// 미수금현황/미지급금현황 공용 — KPI 타일 4개(합계/거래처수/평균/최장연체) +
// 연체 구간별 분포 막대. 두 화면이 같은 모양을 쓰게 해서(사용자 지적) 한
// 쪽을 고치면 자동으로 같이 바뀌게 한다.
export function BalanceAgingSummary({
  rows,
  totalLabel,
  partyCountLabel,
}: {
  rows: BalanceRow[];
  totalLabel: string;
  partyCountLabel: string;
}) {
  return <BalanceSummaryView summary={buildAgingSummary(rows)} totalLabel={totalLabel} partyCountLabel={partyCountLabel} />;
}
