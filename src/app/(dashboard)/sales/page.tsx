import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("sales_order_items")
    .select(
      "*, sales_orders!inner(id, order_date, memo, customers(name)), products(sku, name, spec, unit)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) query = query.gte("sales_orders.order_date", from);
  if (to) query = query.lte("sales_orders.order_date", to);

  const { data: rawItems } = await query;

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.sales_orders?.customers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword)
      )
    : rawItems;

  const rows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  const totalSupply = rows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = rows.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">영업관리 &gt; 수주관리</h1>

      <form method="get" className="erp-search">
        <div className="erp-field">
          <label>시작일</label>
          <input type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label>종료일</label>
          <input type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label>거래처 / 상품 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="거래처명, 상품명, SKU"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q) && (
          <Link href="/sales" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar">
        <Link href="/sales/new" className="erp-btn erp-btn-primary">
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
              <th>거래일자</th>
              <th>거래처</th>
              <th>품목명</th>
              <th>규격</th>
              <th className="num">수량</th>
              <th className="num">단가</th>
              <th className="num">공급가액</th>
              <th className="num">세액</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const order = item.sales_orders;
              return (
                <ClickableRow key={item.id} href={order ? `/sales/${order.id}` : "#"}>
                  <td>{order ? new Date(order.order_date).toLocaleDateString("ko-KR") : "-"}</td>
                  <td>{order?.customers?.name}</td>
                  <td>{item.products?.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{item.products?.spec ?? "-"}</td>
                  <td className="num">
                    {item.quantity.toLocaleString()} {item.products?.unit}
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {Number(item.unit_price).toLocaleString()}
                  </td>
                  <td className="num">{item.supplyAmount.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {item.taxAmount.toLocaleString()}
                  </td>
                  <td className="num">
                    {order && (
                      <Link
                        href={`/sales/${order.id}/print`}
                        style={{ color: "var(--erp-primary)", fontWeight: 600 }}
                      >
                        명세표 →
                      </Link>
                    )}
                  </td>
                </ClickableRow>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="erp-grid-empty">
                  조건에 맞는 판매 거래가 없습니다.
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
                <td className="num">{totalSupply.toLocaleString()}</td>
                <td className="num">{totalTax.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
