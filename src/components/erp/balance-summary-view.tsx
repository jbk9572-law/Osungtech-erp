"use client";

import { formatNumber } from "@/lib/format-number";
import type { AgingSummary } from "@/lib/aging-summary";
import { AgingDistributionBar } from "@/components/erp/aging-distribution-bar";
import { KpiStripFrame } from "@/components/erp/kpi-strip-frame";
import { ListSummaryBar } from "@/components/grid/list-summary-bar";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 미수금/미지급금 요약의 화면 부분 — 서버 컴포넌트(BalanceAgingSummary)가 집계만 하고, 모양은 테마를 읽는 이 클라이언트 부품이 고른다.
// 새 틀(모던): 숫자 카드 4개 + 분포 막대 두 겹 대신 요약 줄 한 줄(칸 구분) + 얇은 분포 막대 — 다른 목록의 요약 줄과 같은 모양.
export function BalanceSummaryView({ summary, totalLabel, partyCountLabel }: { summary: AgingSummary; totalLabel: string; partyCountLabel: string }) {
  const { listFrameV2 } = useThemeFeatures();

  if (listFrameV2) {
    return (
      <>
        <ListSummaryBar
          items={[
            { label: totalLabel, value: `${formatNumber(summary.totalBalance)}원` },
            { label: partyCountLabel, value: `${summary.partyCount}개사` },
            { label: "거래처당 평균", value: `${formatNumber(Math.round(summary.avgBalance))}원` },
            { label: "최장 연체", value: summary.maxDaysOverdue > 0 ? `D+${summary.maxDaysOverdue}` : "-" },
          ]}
        />
        <AgingDistributionBar buckets={summary.buckets} />
      </>
    );
  }

  return (
    <KpiStripFrame>
      <div className="erp-kpi-row">
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">{totalLabel}</div>
          <div className="erp-kpi-value erp-u-danger">{formatNumber(summary.totalBalance)}원</div>
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
    </KpiStripFrame>
  );
}
