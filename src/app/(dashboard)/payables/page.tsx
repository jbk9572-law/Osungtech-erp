import { createClient } from "@/lib/supabase/server";
import { BalanceGridTable, type BalanceRow } from "@/components/balance-grid-table";
import { getAllSupplierBalances, daysSince } from "@/lib/ar-ap";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";
import { ExcelDownloadLink } from "@/components/erp/excel-download-link";
import { DetailPageHeader } from "@/components/erp/page-header";
import { BalanceAgingSummary } from "@/components/erp/balance-aging-summary";

export default async function PayablesPage() {
  const supabase = await createClient();

  if (!(await canViewPage(supabase, "/payables"))) {
    return (
      <AccessWall
        title="거래처관리 > 미지급금현황"
        message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요."
        backHref="/dashboard"
      />
    );
  }

  const balances = await getAllSupplierBalances(supabase);

  const withBalance: BalanceRow[] = balances
    .filter((b) => b.balance !== 0)
    .sort((a, b) => b.balance - a.balance)
    .map((b) => ({
      id: b.id,
      name: b.name,
      total: b.total,
      paid: b.paid,
      balance: b.balance,
      // balance<=0(미지급금 없음)인 공급처는 oldest_unpaid_date가 애초에 null이다.
      // daysSince는 서버 컴포넌트에서만 호출(KST 기준 todayKstStr() 기본값 사용).
      daysOverdue: b.balance > 0 && b.oldestUnpaidDate ? daysSince(b.oldestUnpaidDate) : 0,
    }));

  return (
    <div>
      <DetailPageHeader
        title="거래처관리 > 미지급금현황"
        actions={<ExcelDownloadLink href="/api/payables/export" />}
      />

      <BalanceAgingSummary rows={withBalance} totalLabel="전체 미지급금 합계" partyCountLabel="미지급 거래처" />

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
