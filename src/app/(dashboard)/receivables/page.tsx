import { createClient } from "@/lib/supabase/server";
import { BalanceGridTable, type BalanceRow } from "@/components/balance-grid-table";
import { getAllCustomerBalances, sumOutstandingBalance, daysSince } from "@/lib/ar-ap";
import { formatNumber } from "@/lib/format-number";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";
import { ExcelDownloadLink } from "@/components/erp/excel-download-link";
import { DetailPageHeader } from "@/components/erp/page-header";
import { AgingDistributionBar, type AgingBucket } from "@/components/erp/aging-distribution-bar";

export default async function ReceivablesPage() {
  const supabase = await createClient();

  if (!(await canViewPage(supabase, "/receivables"))) {
    return (
      <AccessWall
        title="거래처관리 > 미수금현황"
        message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요."
        backHref="/dashboard"
      />
    );
  }

  const balances = await getAllCustomerBalances(supabase);

  const withBalance: BalanceRow[] = balances
    .filter((b) => b.balance !== 0)
    .sort((a, b) => b.balance - a.balance)
    .map((b) => ({
      id: b.id,
      name: b.name,
      total: b.total,
      paid: b.paid,
      balance: b.balance,
      // balance<=0(미수금 없음)인 거래처는 oldest_unpaid_date가 애초에 null이다.
      // daysSince는 서버 컴포넌트에서만 호출(KST 기준 todayKstStr() 기본값 사용).
      daysOverdue: b.balance > 0 && b.oldestUnpaidDate ? daysSince(b.oldestUnpaidDate) : 0,
    }));

  const totalBalance = sumOutstandingBalance(withBalance);
  const partyCount = withBalance.length;
  const avgBalance = partyCount > 0 ? totalBalance / partyCount : 0;
  const maxDaysOverdue = withBalance.reduce((max, b) => Math.max(max, b.daysOverdue ?? 0), 0);

  const agingBuckets: AgingBucket[] = [
    { label: "정상", tone: "ok", ...bucketStats(withBalance, (d) => d <= 0) },
    { label: "1~89일 연체", tone: "warn", ...bucketStats(withBalance, (d) => d > 0 && d < 90) },
    { label: "90일+ 연체", tone: "danger", ...bucketStats(withBalance, (d) => d >= 90) },
  ];

  return (
    <div>
      <DetailPageHeader
        title="거래처관리 > 미수금현황"
        actions={<ExcelDownloadLink href="/api/receivables/export" />}
      />

      <div className="erp-kpi-row" style={{ marginBottom: 16 }}>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">전체 미수금 합계</div>
          <div className="erp-kpi-value" style={{ color: "var(--erp-danger)" }}>
            {formatNumber(totalBalance)}원
          </div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">미수 거래처</div>
          <div className="erp-kpi-value">{partyCount}개사</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">거래처당 평균</div>
          <div className="erp-kpi-value">{formatNumber(Math.round(avgBalance))}원</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">최장 연체일수</div>
          <div className="erp-kpi-value">{maxDaysOverdue > 0 ? `D+${maxDaysOverdue}` : "-"}</div>
        </div>
      </div>

      <AgingDistributionBar buckets={agingBuckets} />

      <BalanceGridTable
        rows={withBalance}
        hrefBase="/customers"
        partyLabel="출고처명"
        totalLabel="매출 누계"
        paidLabel="수금 누계"
        emptyLabel="미수금 잔액이 있는 거래처가 없습니다."
      />
    </div>
  );
}

function bucketStats(rows: BalanceRow[], match: (daysOverdue: number) => boolean): { count: number; amount: number } {
  const matched = rows.filter((r) => match(r.daysOverdue ?? 0));
  return { count: matched.length, amount: matched.reduce((sum, r) => sum + r.balance, 0) };
}
