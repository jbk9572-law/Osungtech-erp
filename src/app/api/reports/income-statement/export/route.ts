import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { effectiveMonth } from "@/lib/carryover";

// 간이 손익계산서 엑셀 다운로드 — 화면(reports/income-statement/page.tsx)과
// 완전히 같은 조회/집계 로직을 그대로 따른다(이월 lookback, unit_cost 스냅샷 등).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || currentMonth();
  const { from, to } = getMonthRange(month);

  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

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

  const rows = [
    { 항목: "매출액", 금액: revenue },
    { 항목: "매출원가", 금액: cogs },
    { 항목: "매출총이익", 금액: grossProfit },
    { 항목: "판매관리비(승인된 지급결의 기준)", 금액: sgaExpense },
    { 항목: "영업이익", 금액: operatingProfit },
  ];

  return buildXlsxResponse(rows, `간이손익계산서_${month}.xlsx`);
}
