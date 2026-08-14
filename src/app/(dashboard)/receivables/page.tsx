import { createClient } from "@/lib/supabase/server";
import { BalanceGridTable } from "@/components/balance-grid-table";
import { getAllCustomerBalances } from "@/lib/ar-ap";

export default async function ReceivablesPage() {
  const supabase = await createClient();
  const balances = await getAllCustomerBalances(supabase);

  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);
  const totalBalance = withBalance.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">거래처관리 &gt; 미수금현황</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">전체 미수금 합계</span>
        </div>
        <div className="erp-detail-body">
          <span className="text-sm font-bold" style={{ color: "var(--erp-danger)" }}>
            {totalBalance.toLocaleString()}원
          </span>
        </div>
      </div>

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
