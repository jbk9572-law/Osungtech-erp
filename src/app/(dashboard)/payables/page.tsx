import { createClient } from "@/lib/supabase/server";
import { BalanceGridTable } from "@/components/balance-grid-table";
import { getAllSupplierBalances, sumOutstandingBalance } from "@/lib/ar-ap";
import { formatNumber } from "@/lib/format-number";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

export default async function PayablesPage() {
  const supabase = await createClient();

  if (!(await canViewPage(supabase, "/payables"))) {
    return (
      <AccessWall
        title="거래처관리 > 미지급금현황"
        message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요."
      />
    );
  }

  const balances = await getAllSupplierBalances(supabase);

  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);
  const totalBalance = sumOutstandingBalance(withBalance);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">거래처관리 &gt; 미지급금현황</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <a href="/api/payables/export" className="erp-btn" title="현재 화면 그대로 엑셀로 다운로드">
            📥 엑셀 다운로드
          </a>
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">전체 미지급금 합계</span>
        </div>
        <div className="erp-detail-body">
          <span className="text-sm font-bold" style={{ color: "var(--erp-danger)" }}>
            {formatNumber(totalBalance)}원
          </span>
        </div>
      </div>

      <BalanceGridTable
        rows={withBalance}
        hrefBase="/suppliers"
        partyLabel="공급처명"
        totalLabel="매입 누계"
        paidLabel="지급 누계"
        emptyLabel="미지급금 잔액이 있는 공급처가 없습니다."
      />
    </div>
  );
}
