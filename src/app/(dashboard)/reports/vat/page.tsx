import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { calcVat } from "@/lib/tax";

type TaxType = "과세" | "면세" | "영세";

function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3; // 0-indexed
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function emptyTotals() {
  return { 과세: 0, 면세: 0, 영세: 0 };
}

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const now = new Date();
  const defaultQuarter = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const defaultRange = quarterRange(now.getFullYear(), defaultQuarter);
  const { from: fromParam, to: toParam } = await searchParams;
  const from = fromParam || defaultRange.from;
  const to = toParam || defaultRange.to;

  const supabase = await createClient();

  const [salesRows, purchaseRows] = await Promise.all([
    fetchAllRows<{ id: string; is_return: boolean; tax_type: TaxType; sales_order_items: { quantity: number; unit_price: number }[] }>(
      (f, t) =>
        supabase
          .from("sales_orders")
          .select("id, is_return, tax_type, sales_order_items(quantity, unit_price)")
          .gte("order_date", from)
          .lte("order_date", to)
          .range(f, t)
    ),
    fetchAllRows<{ id: string; tax_type: TaxType; purchase_order_items: { quantity: number; unit_cost: number }[] }>((f, t) =>
      supabase
        .from("purchase_orders")
        .select("id, tax_type, purchase_order_items(quantity, unit_cost)")
        .gte("purchase_date", from)
        .lte("purchase_date", to)
        .range(f, t)
    ),
  ]);

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

  const quarterLinks = ([1, 2, 3, 4] as const).map((q) => ({
    label: `${now.getFullYear()}년 ${q}분기`,
    ...quarterRange(now.getFullYear(), q),
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="부가세 신고 자료" />
      <PageGuide>
        매출/매입 전표에 이미 등록된 과세유형(과세/면세/영세)을 기준으로 매출세액·매입세액을 자동 집계합니다.
        실제 신고는 담당 세무사/홈택스를 통해 별도로 진행해주세요 — 이 화면은 신고 전 참고 자료입니다.
      </PageGuide>

      <div className="erp-toolbar">
        {quarterLinks.map((q) => (
          <Link key={q.label} href={`/reports/vat?from=${q.from}&to=${q.to}`} className={`erp-btn${q.from === from && q.to === to ? " erp-btn-primary" : ""}`}>
            {q.label}
          </Link>
        ))}
      </div>

      <form className="erp-toolbar" style={{ marginTop: -4 }}>
        <input type="date" name="from" defaultValue={from} className="erp-input" style={{ width: "auto" }} />
        <span>~</span>
        <input type="date" name="to" defaultValue={to} className="erp-input" style={{ width: "auto" }} />
        <button type="submit" className="erp-btn">
          조회
        </button>
      </form>

      <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        조회기간: {from.replaceAll("-", ".")} ~ {to.replaceAll("-", ".")}
      </p>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th></th>
              <th className="num">과세 공급가액</th>
              <th className="num">영세 공급가액</th>
              <th className="num">면세 공급가액</th>
              <th className="num">세액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700 }}>매출</td>
              <td className="num">{salesSupply.과세.toLocaleString()}</td>
              <td className="num">{salesSupply.영세.toLocaleString()}</td>
              <td className="num">{salesSupply.면세.toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700 }}>{salesTax.toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>매입</td>
              <td className="num">{purchaseSupply.과세.toLocaleString()}</td>
              <td className="num">{purchaseSupply.영세.toLocaleString()}</td>
              <td className="num">{purchaseSupply.면세.toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700 }}>{purchaseTax.toLocaleString()}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="num" style={{ fontWeight: 700 }}>
                {payable >= 0 ? "납부(예상) 세액" : "환급(예상) 세액"}
              </td>
              <td className="num" style={{ fontWeight: 700, color: payable >= 0 ? "var(--erp-danger)" : "var(--erp-success)" }}>
                {Math.abs(payable).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
