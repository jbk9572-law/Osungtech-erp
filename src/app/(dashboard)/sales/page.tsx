import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

type DisplayRow = {
  key: string;
  orderId: string | undefined;
  date: string | undefined;
  customerName: string | undefined;
  productLabel: string;
  spec: string;
  quantity: number;
  unit: string | null | undefined;
  unitPrice: number | null;
  supplyAmount: number;
  taxAmount: number;
};

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

  const itemRows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  // 검색어 없이 조회할 때는 한 명세표(sales_order)를 한 행으로 묶어서 보여준다.
  // 품목이 여러 개면 품목명 칸에 "첫 품목명 외 N건"으로 요약하고, 나머지 품목은
  // 리스트에 펼쳐 보이지 않는다. 거래처/상품 검색어가 있을 때만(특정 품목을
  // 찾는 상황) 품목별로 전체 펼쳐서 보여준다.
  const rows: DisplayRow[] = keyword
    ? itemRows.map((item) => ({
        key: item.id,
        orderId: item.sales_orders?.id,
        date: item.sales_orders?.order_date,
        customerName: item.sales_orders?.customers?.name,
        productLabel: item.products?.name ?? "-",
        spec: item.spec || item.products?.spec || "-",
        quantity: item.quantity,
        unit: item.products?.unit,
        unitPrice: Number(item.unit_price),
        supplyAmount: item.supplyAmount,
        taxAmount: item.taxAmount,
      }))
    : Object.values(
        itemRows.reduce<Record<string, DisplayRow & { itemCount: number }>>((acc, item) => {
          const orderId = item.sales_orders?.id ?? item.id;
          if (!acc[orderId]) {
            acc[orderId] = {
              key: orderId,
              orderId,
              date: item.sales_orders?.order_date,
              customerName: item.sales_orders?.customers?.name,
              productLabel: item.products?.name ?? "-",
              spec: item.spec || item.products?.spec || "-",
              quantity: 0,
              unit: item.products?.unit,
              unitPrice: null,
              supplyAmount: 0,
              taxAmount: 0,
              itemCount: 0,
            };
          }
          acc[orderId].itemCount += 1;
          acc[orderId].quantity += item.quantity;
          acc[orderId].supplyAmount += item.supplyAmount;
          acc[orderId].taxAmount += item.taxAmount;
          return acc;
        }, {})
      ).map((row) => ({
        ...row,
        productLabel: row.itemCount > 1 ? `${row.productLabel} 외 ${row.itemCount - 1}건` : row.productLabel,
      }));

  const totalSupply = itemRows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = itemRows.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalQuantity = itemRows.reduce((sum, row) => sum + row.quantity, 0);
  const presets = getDatePresets();

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/sales/new" },
          F5: { submitFormSelector: "#sales-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">영업관리 &gt; 매출관리</h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/sales?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <form method="get" id="sales-search-form" className="erp-search">
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
            {rows.map((row) => (
              <ClickableRow key={row.key} href={row.orderId ? `/sales/${row.orderId}` : "#"}>
                <td>{row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "-"}</td>
                <td>{row.customerName}</td>
                <td>{row.productLabel}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.spec}</td>
                <td className="num">
                  {row.quantity.toLocaleString()} {row.unit}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {row.unitPrice != null ? row.unitPrice.toLocaleString() : "-"}
                </td>
                <td className="num">{row.supplyAmount.toLocaleString()}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {row.taxAmount.toLocaleString()}
                </td>
                <td className="num">
                  {row.orderId && (
                    <Link
                      href={`/sales/${row.orderId}/print`}
                      style={{ color: "var(--erp-primary)", fontWeight: 600 }}
                    >
                      명세표 →
                    </Link>
                  )}
                </td>
              </ClickableRow>
            ))}
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
