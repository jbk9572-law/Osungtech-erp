import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { calcVat } from "@/lib/tax";
import { nowInKst } from "@/lib/kst-date";
import { shiftMonth } from "@/lib/date-presets";
import { effectiveMonth } from "@/lib/carryover";

type TaxType = "과세" | "면세" | "영세";

function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function emptyTotals() {
  return { 과세: 0, 면세: 0, 영세: 0 };
}

function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = from.slice(0, 7);
  const last = to.slice(0, 7);
  for (let i = 0; i < 24 && cursor <= last; i++) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

// 부가세 신고 자료 엑셀 다운로드 — 화면(reports/vat/page.tsx)과 같은
// 조회기간 기본값·이월(carryover) 처리 로직을 그대로 따른다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = nowInKst();
  const currentYear = now.getUTCFullYear();
  const defaultQuarter = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const defaultRange = quarterRange(currentYear, defaultQuarter);
  const from = searchParams.get("from") || defaultRange.from;
  const to = searchParams.get("to") || defaultRange.to;

  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const lookbackFrom = shiftMonth(from.slice(0, 7), -1) + "-01";
  const months = monthsInRange(from, to);

  const [salesRowsRaw, purchaseRowsRaw] = await Promise.all([
    fetchAllRows<{
      is_return: boolean;
      tax_type: TaxType;
      order_date: string;
      is_carryover: boolean;
      sales_order_items: { quantity: number; unit_price: number }[];
    }>((f, t) =>
      supabase
        .from("sales_orders")
        .select("is_return, tax_type, order_date, is_carryover, sales_order_items(quantity, unit_price)")
        .gte("order_date", lookbackFrom)
        .lte("order_date", to)
        .range(f, t)
    ),
    fetchAllRows<{
      tax_type: TaxType;
      purchase_date: string;
      is_carryover: boolean;
      purchase_order_items: { quantity: number; unit_cost: number }[];
    }>((f, t) =>
      supabase
        .from("purchase_orders")
        .select("tax_type, purchase_date, is_carryover, purchase_order_items(quantity, unit_cost)")
        .gte("purchase_date", lookbackFrom)
        .lte("purchase_date", to)
        .range(f, t)
    ),
  ]);

  const salesRows = salesRowsRaw.filter((r) => months.includes(effectiveMonth(r.order_date, r.is_carryover)));
  const purchaseRows = purchaseRowsRaw.filter((r) => months.includes(effectiveMonth(r.purchase_date, r.is_carryover)));

  const salesSupply = emptyTotals();
  for (const order of salesRows) {
    const sign = order.is_return ? -1 : 1;
    const amount = order.sales_order_items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0) * sign;
    salesSupply[order.tax_type] += amount;
  }

  const purchaseSupply = emptyTotals();
  for (const order of purchaseRows) {
    const amount = order.purchase_order_items.reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0);
    purchaseSupply[order.tax_type] += amount;
  }

  const salesTax = calcVat(salesSupply.과세);
  const purchaseTax = calcVat(purchaseSupply.과세);
  const payable = salesTax - purchaseTax;

  const rows = [
    {
      구분: "매출",
      "과세 공급가액": salesSupply.과세,
      "영세 공급가액": salesSupply.영세,
      "면세 공급가액": salesSupply.면세,
      세액: salesTax,
    },
    {
      구분: "매입",
      "과세 공급가액": purchaseSupply.과세,
      "영세 공급가액": purchaseSupply.영세,
      "면세 공급가액": purchaseSupply.면세,
      세액: purchaseTax,
    },
    {
      구분: payable >= 0 ? "납부(예상) 세액" : "환급(예상) 세액",
      "과세 공급가액": "",
      "영세 공급가액": "",
      "면세 공급가액": "",
      세액: Math.abs(payable),
    },
  ];

  return buildXlsxResponse(rows, `부가세신고자료_${from}_${to}.xlsx`);
}
