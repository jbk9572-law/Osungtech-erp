import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { getAllCustomerBalances } from "@/lib/ar-ap";

export default async function ReceivablesPage() {
  const supabase = await createClient();
  const balances = await getAllCustomerBalances(supabase);

  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);
  const totalBalance = withBalance.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#182338]">거래처관리 &gt; 미수금현황</h1>

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

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>출고처명</th>
              <th className="num">매출 누계</th>
              <th className="num">수금 누계</th>
              <th className="num">잔액</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {withBalance.map((b) => (
              <ClickableRow key={b.id} href={`/customers/${b.id}`}>
                <td>{b.name}</td>
                <td className="num">{b.total.toLocaleString()}</td>
                <td className="num">{b.paid.toLocaleString()}</td>
                <td className="num" style={{ color: b.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}>
                  {b.balance.toLocaleString()}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  상세 →
                </td>
              </ClickableRow>
            ))}
            {!withBalance.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  미수금 잔액이 있는 거래처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
