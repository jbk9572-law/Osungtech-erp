import { createClient } from "@/lib/supabase/server";
import { BalanceGridTable } from "@/components/balance-grid-table";
import { getAllSupplierBalances } from "@/lib/ar-ap";

export default async function PayablesPage() {
  const supabase = await createClient();
  const balances = await getAllSupplierBalances(supabase);

  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);
  const totalBalance = withBalance.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">거래처관리 &gt; 미지급금현황</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">전체 미지급금 합계</span>
        </div>
        <div className="erp-detail-body">
          <span className="text-sm font-bold" style={{ color: "var(--erp-danger)" }}>
            {totalBalance.toLocaleString()}원
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
