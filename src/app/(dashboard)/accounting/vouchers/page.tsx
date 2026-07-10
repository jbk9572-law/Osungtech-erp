import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

type Voucher = {
  id: string;
  type: "매출" | "매입";
  date: string;
  partnerName: string;
  amount: number;
  href: string;
};

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  const supabase = await createClient();

  let salesQuery = supabase
    .from("sales_orders")
    .select("id, order_date, customers(name), sales_order_items(quantity, unit_price)")
    .order("order_date", { ascending: false })
    .limit(200);
  let purchasesQuery = supabase
    .from("purchase_orders")
    .select("id, purchase_date, suppliers(name), purchase_order_items(quantity, unit_cost)")
    .order("purchase_date", { ascending: false })
    .limit(200);

  if (from) {
    salesQuery = salesQuery.gte("order_date", from);
    purchasesQuery = purchasesQuery.gte("purchase_date", from);
  }
  if (to) {
    salesQuery = salesQuery.lte("order_date", to);
    purchasesQuery = purchasesQuery.lte("purchase_date", to);
  }

  const [{ data: salesOrders }, { data: purchaseOrders }] = await Promise.all([
    salesQuery,
    purchasesQuery,
  ]);

  const vouchers: Voucher[] = [
    ...(salesOrders ?? []).map((o) => ({
      id: o.id,
      type: "매출" as const,
      date: o.order_date,
      partnerName: o.customers?.name ?? "-",
      amount: (o.sales_order_items ?? []).reduce(
        (sum, item) => sum + item.quantity * Number(item.unit_price),
        0
      ),
      href: `/sales/${o.id}`,
    })),
    ...(purchaseOrders ?? []).map((o) => ({
      id: o.id,
      type: "매입" as const,
      date: o.purchase_date,
      partnerName: o.suppliers?.name ?? "-",
      amount: (o.purchase_order_items ?? []).reduce(
        (sum, item) => sum + item.quantity * Number(item.unit_cost),
        0
      ),
      href: `/purchases/${o.id}`,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const keyword = q?.trim().toLowerCase();
  const rows = keyword
    ? vouchers.filter((v) => v.partnerName.toLowerCase().includes(keyword))
    : vouchers;

  const totalSales = rows.filter((v) => v.type === "매출").reduce((sum, v) => sum + v.amount, 0);
  const totalPurchases = rows
    .filter((v) => v.type === "매입")
    .reduce((sum, v) => sum + v.amount, 0);
  const presets = getDatePresets();

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F5: { submitFormSelector: "#vouchers-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">회계관리 &gt; 전표관리</h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/accounting/vouchers?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <form method="get" id="vouchers-search-form" className="erp-search">
        <div className="erp-field">
          <label>시작일</label>
          <input type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label>종료일</label>
          <input type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label>거래처 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="거래처명, 공급업체명"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q) && (
          <Link href="/accounting/vouchers" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar">
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>구분</th>
              <th>일자</th>
              <th>거래처</th>
              <th className="num">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <ClickableRow key={`${v.type}-${v.id}`} href={v.href}>
                <td>
                  <span
                    style={{
                      color: v.type === "매출" ? "var(--erp-primary)" : "#b45309",
                      fontWeight: 600,
                    }}
                  >
                    {v.type}
                  </span>
                </td>
                <td>{new Date(v.date).toLocaleDateString("ko-KR")}</td>
                <td>{v.partnerName}</td>
                <td className="num">{v.amount.toLocaleString()}</td>
              </ClickableRow>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
                  조건에 맞는 전표가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                <td colSpan={3}>합계 ({rows.length}건)</td>
                <td className="num">{(totalSales - totalPurchases).toLocaleString()}</td>
              </tr>
              <tr style={{ background: "#f5f7fa", color: "var(--erp-text-muted)" }}>
                <td colSpan={3}>매출 {totalSales.toLocaleString()} / 매입 {totalPurchases.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
