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
    // 거래일자(업무상 날짜) 기준으로 최신이 위로 오게 정렬한다. 이전에는
    // 품목의 시스템 생성시각(created_at)으로 정렬했는데, 수정 시 품목을
    // 지웠다가 다시 넣는 방식이라 오래된 거래를 수정만 해도 최상단으로
    // 튀어올라 거래일자와 무관하게 뒤죽박죽으로 보였다.
    // supabase-js의 `{ foreignTable }` 옵션은 상위(base) 테이블을 하위
    // 임베드 테이블 값으로 정렬하는 방향으로는 실제로 적용되지 않는
    // postgrest-js의 알려진 제약이라(order 자체가 조용히 무시됨),
    // PostgREST의 `table(column)` 표기를 컬럼명 자리에 직접 써서 우회한다.
    .order("sales_orders(order_date)", { ascending: false })
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
          item.products?.sku?.toLowerCase().includes(keyword) ||
          (item.spec || item.products?.spec)?.toLowerCase().includes(keyword)
      )
    : rawItems;

  const itemRows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  // 같은 명세표(sales_order)에 속한 품목은 검색 여부와 상관없이 한 행으로
  // 묶어서 보여준다. 품목이 여러 개면 품목명 칸에 "첫 품목명 외 N건"으로
  // 요약한다. 검색어로 일부 품목만 걸러졌다면(예: 상품명/SKU 검색) 그
  // 매칭된 품목들만 묶여서 "외 N건"에 반영된다.
  const rows: DisplayRow[] = Object.values(
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
          unitPrice: Number(item.unit_price),
          supplyAmount: 0,
          taxAmount: 0,
          itemCount: 0,
        };
      } else {
        // 품목이 2건 이상이면 단가를 하나로 대표할 수 없으니 비워둔다.
        acc[orderId].unitPrice = null;
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
  const exportHref = q ? `/api/sales/export?q=${encodeURIComponent(q)}` : "/api/sales/export";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/sales/new" },
          F5: { submitFormSelector: "#sales-search-form" },
          F8: { href: exportHref, newTab: true },
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
          <label>거래처 / 상품 / 규격 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="거래처명, 상품명, SKU, 규격"
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
        <a
          href={exportHref}
          className="erp-btn"
          title={q ? `이번달 "${q}" 검색 결과를 엑셀로 다운로드` : "이번달(1일~말일) 전체 내역을 엑셀로 다운로드"}
        >
          📥 엑셀 다운로드
        </a>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
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
              <th className="num">공급가</th>
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
                      target="_blank"
                      rel="noopener noreferrer"
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
