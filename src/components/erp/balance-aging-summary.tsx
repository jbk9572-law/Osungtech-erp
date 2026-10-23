import { formatNumber } from "@/lib/format-number";
import { buildAgingSummary } from "@/lib/aging-summary";
import { AgingDistributionBar } from "@/components/erp/aging-distribution-bar";
import type { BalanceRow } from "@/components/balance-grid-table";

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
  const summary = buildAgingSummary(rows);

  return (
    <>
      <div className="erp-kpi-row" style={{ marginBottom: 16 }}>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">{totalLabel}</div>
          <div className="erp-kpi-value" style={{ color: "var(--erp-danger)" }}>
            {formatNumber(summary.totalBalance)}원
          </div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">{partyCountLabel}</div>
          <div className="erp-kpi-value">{summary.partyCount}개사</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">거래처당 평균</div>
          <div className="erp-kpi-value">{formatNumber(Math.round(summary.avgBalance))}원</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">최장 연체일수</div>
          <div className="erp-kpi-value">{summary.maxDaysOverdue > 0 ? `D+${summary.maxDaysOverdue}` : "-"}</div>
        </div>
      </div>

      <AgingDistributionBar buckets={summary.buckets} />
    </>
  );
}
