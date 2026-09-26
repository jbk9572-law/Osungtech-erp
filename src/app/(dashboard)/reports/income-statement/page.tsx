import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { effectiveMonth } from "@/lib/carryover";

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = monthParam || currentMonth();
  const { from, to } = getMonthRange(month);
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const supabase = await createClient();

  // 이월(is_carryover) 건은 거래일자가 실제로는 전월인데 이번 달 실적으로
  // 잡혀야 하므로(월별 리포트와 동일한 effectiveMonth 규칙), 조회 범위를
  // 전월 1일까지 넓혀서 가져온 뒤 실적월 기준으로 다시 걸러야 한다 —
  // reports/monthly와 같은 패턴.
  const { from: lookbackFrom } = getMonthRange(shiftMonth(month, -1));

  const [salesRowsRaw, approvedExpenseRows] = await Promise.all([
    fetchAllRows<{
      quantity: number;
      unit_price: number;
      unit_cost: number;
      sales_orders: { is_return: boolean; order_date: string; is_carryover: boolean } | null;
    }>((f, t) =>
      supabase
        .from("sales_order_items")
        .select("quantity, unit_price, unit_cost, sales_orders!inner(is_return, order_date, is_carryover)")
        .gte("sales_orders.order_date", lookbackFrom)
        .lte("sales_orders.order_date", to)
        .range(f, t)
    ),
    fetchAllRows<{ amount: number; used_at: string; payment_requests: { status: string } | null }>((f, t) =>
      supabase
        .from("payment_request_line_items")
        .select("amount, used_at, payment_requests!inner(status)")
        .eq("payment_requests.status", "approved")
        .gte("used_at", from)
        .lte("used_at", to)
        .range(f, t)
    ),
  ]);

  const salesRows = salesRowsRaw.filter(
    (r) => effectiveMonth(r.sales_orders?.order_date ?? "", r.sales_orders?.is_carryover ?? false) === month,
  );

  let revenue = 0;
  let cogs = 0;
  for (const row of salesRows) {
    const sign = row.sales_orders?.is_return ? -1 : 1;
    revenue += row.quantity * Number(row.unit_price) * sign;
    cogs += row.quantity * Number(row.unit_cost) * sign;
  }

  const grossProfit = revenue - cogs;
  const sgaExpense = approvedExpenseRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const operatingProfit = grossProfit - sgaExpense;

  const rows: { label: string; value: number; bold?: boolean }[] = [
    { label: "매출액", value: revenue },
    { label: "매출원가", value: cogs },
    { label: "매출총이익", value: grossProfit, bold: true },
    { label: "판매관리비(승인된 지급결의 기준)", value: sgaExpense },
    { label: "영업이익", value: operatingProfit, bold: true },
  ];

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="간이 손익계산서" />
      <PageGuide>
        매출/매입 전표의 판매단가·품목원가와, 승인 완료된 지급결의서 금액을 기준으로 자동 계산한 간이 손익계산서입니다.
        실제 세무 신고용 재무제표가 아니라 내부 경영 참고용입니다(감가상각, 인건비 등은 포함되지 않습니다).
      </PageGuide>

      <div className="erp-toolbar">
        <Link href={`/reports/income-statement?month=${prevMonth}`} className="erp-btn">
          ← {prevMonth}
        </Link>
        <span style={{ fontWeight: 700, padding: "0 8px" }}>{month}</span>
        <Link href={`/reports/income-statement?month=${nextMonth}`} className="erp-btn">
          {nextMonth} →
        </Link>
        <a
          href={`/api/reports/income-statement/export?month=${month}`}
          className="erp-btn"
          title="현재 화면 그대로 엑셀로 다운로드"
          style={{ marginLeft: "auto" }}
        >
          📥 엑셀 다운로드
        </a>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>항목</th>
              <th className="num">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={{ fontWeight: r.bold ? 700 : 400 }}>{r.label}</td>
                <td
                  className="num"
                  style={{
                    fontWeight: r.bold ? 700 : 400,
                    color: r.value < 0 ? "var(--erp-danger)" : "var(--erp-text)",
                  }}
                >
                  {r.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
