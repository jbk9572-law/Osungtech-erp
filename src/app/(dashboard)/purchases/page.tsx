import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("purchase_order_items")
    .select(
      "*, purchase_orders!inner(id, purchase_date, memo, suppliers(name)), products(sku, name, spec, unit)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) query = query.gte("purchase_orders.purchase_date", from);
  if (to) query = query.lte("purchase_orders.purchase_date", to);

  const { data: rawItems } = await query;

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.purchase_orders?.suppliers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword)
      )
    : rawItems;

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_cost),
  }));

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const presets = getDatePresets();

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/purchases/new" },
          F5: { submitFormSelector: "#purchases-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">구매관리 &gt; 발주관리</h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/purchases?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <form method="get" id="purchases-search-form" className="erp-search">
        <div className="erp-field">
          <label>시작일</label>
          <input type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label>종료일</label>
          <input type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label>공급업체 / 상품 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="공급업체명, 상품명, SKU"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q) && (
          <Link href="/purchases" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar">
        <Link href="/purchases/new" className="erp-btn erp-btn-primary">
          F2 신규
        </Link>
        <button type="button" className="erp-btn" disabled>
          F8 엑셀
        </button>
        <Link href="/dashboard" className="erp-btn">
          ESC 닫기
        </Link>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>매입일자</th>
              <th>공급업체</th>
              <th>품목명</th>
              <th>규격</th>
              <th className="num">수량</th>
              <th className="num">매입단가</th>
              <th className="num">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const order = item.purchase_orders;
              return (
                <ClickableRow key={item.id} href={order ? `/purchases/${order.id}` : "#"}>
                  <td>{order ? new Date(order.purchase_date).toLocaleDateString("ko-KR") : "-"}</td>
                  <td>{order?.suppliers?.name}</td>
                  <td>{item.products?.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {item.spec || item.products?.spec || "-"}
                  </td>
                  <td className="num">
                    {item.quantity.toLocaleString()} {item.products?.unit}
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {Number(item.unit_cost).toLocaleString()}
                  </td>
                  <td className="num">{item.amount.toLocaleString()}</td>
                </ClickableRow>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  조건에 맞는 매입 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                <td colSpan={4}>합계 ({rows.length}건)</td>
                <td className="num">{totalQuantity.toLocaleString()}</td>
                <td />
                <td className="num">{totalAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
