import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { ReportMoney } from "@/components/daily-report-box";
import { canViewPage } from "@/lib/department-page-access";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { getAllCustomerBalances, getAllSupplierBalances, sumOutstandingBalance, type PartyBalance } from "@/lib/ar-ap";

// 메인 화면 "일일 리포트"의 수금·지급·잔액 — 부서별 화면 접근 권한(미수금현황/미지급금현황)을 그대로 따르고, 권한 없는 쪽은
// null로 내려 리포트가 그 칸을 그리지 않는다. 다른 조회와 상관없어서 화면 맨 처음에 시작해 두고 필요한 곳에서 받는다.
export type DashboardMoney = {
  reportMoney: ReportMoney | null;
  customerBalances: PartyBalance[] | null;
  supplierBalances: PartyBalance[] | null;
};

function sumPaymentsByDate(rows: { paid_at: string; amount: string | number }[]): Record<string, number> {
  const byDate: Record<string, number> = {};
  for (const row of rows) byDate[row.paid_at] = (byDate[row.paid_at] ?? 0) + Number(row.amount);
  return byDate;
}

export async function loadDashboardMoney(supabase: SupabaseClient<Database>, monthStart: string, monthEnd: string): Promise<DashboardMoney> {
  const [canSeeReceivables, canSeePayables] = await Promise.all([canViewPage(supabase, "/receivables"), canViewPage(supabase, "/payables")]);
  const [collectedRows, paidRows, customerBalances, supplierBalances] = await Promise.all([
    canSeeReceivables
      ? fetchAllRows<{ paid_at: string; amount: string | number }>((from, to) =>
          supabase.from("customer_payments").select("paid_at, amount").gte("paid_at", monthStart).lte("paid_at", monthEnd).range(from, to),
        )
      : Promise.resolve(null),
    canSeePayables
      ? fetchAllRows<{ paid_at: string; amount: string | number }>((from, to) =>
          supabase.from("supplier_payments").select("paid_at, amount").gte("paid_at", monthStart).lte("paid_at", monthEnd).range(from, to),
        )
      : Promise.resolve(null),
    canSeeReceivables ? getAllCustomerBalances(supabase) : Promise.resolve(null),
    canSeePayables ? getAllSupplierBalances(supabase) : Promise.resolve(null),
  ]);
  const reportMoney: ReportMoney | null =
    canSeeReceivables || canSeePayables
      ? {
          collectedByDate: collectedRows ? sumPaymentsByDate(collectedRows) : null,
          paidByDate: paidRows ? sumPaymentsByDate(paidRows) : null,
          receivable: customerBalances
            ? { amount: sumOutstandingBalance(customerBalances), parties: customerBalances.filter((b) => b.balance > 0).length }
            : null,
          payable: supplierBalances
            ? { amount: sumOutstandingBalance(supplierBalances), parties: supplierBalances.filter((b) => b.balance > 0).length }
            : null,
        }
      : null;
  return { reportMoney, customerBalances, supplierBalances };
}
