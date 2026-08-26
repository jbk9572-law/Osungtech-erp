import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { buildListReturnParam } from "@/lib/list-return";
import {
  SalesGridTable,
  type SalesRow,
  type SalesRowItem,
} from "@/components/sales-grid-table";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";

type DisplayRow = SalesRow;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  // 상세 화면에서 ESC/닫기를 누르면 지금 걸어둔 검색/필터로 되돌아오게,
  // 목록 링크에 지금 화면의 쿼리스트링을 실어 보낸다.
  const backParam = buildListReturnParam({ q, from, to });
  const supabase = await createClient();

  let query = supabase
    .from("sales_order_items")
    .select(
      "*, sales_orders!inner(id, order_date, memo, delivery_method, customers(id, name), profiles!created_by(full_name)), products(sku, name, spec, unit)",
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

  // 매출 옆에 수금 내역도 같은 목록에 섞어서 보여준다(구 ERP의 "매출"
  // 메뉴 안에 매출/수금 전표가 같이 쌓이던 방식과 동일). 실제 정산 로직은
  // lib/ar-ap.ts 그대로 두고, 여기서는 표시용으로만 합친다.
  let paymentQuery = supabase
    .from("customer_payments")
    .select("id, paid_at, amount, memo, customers(id, name)")
    .order("paid_at", { ascending: false })
    .limit(200);
  if (from) paymentQuery = paymentQuery.gte("paid_at", from);
  if (to) paymentQuery = paymentQuery.lte("paid_at", to);

  const [{ data: rawItems }, { data: rawPayments }] = await Promise.all([
    query,
    paymentQuery,
  ]);

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.sales_orders?.customers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword) ||
          (item.spec || item.products?.spec)?.toLowerCase().includes(keyword),
      )
    : rawItems;

  const itemRows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  // 모조지(TG0) 품목 줄이 있는 명세표만, 그 규격별 배치 내역을 같이 불러와서
  // 드롭다운을 펼쳤을 때 "이 연수가 어떤 규격들로 재단됐는지" 보여준다.
  const orderIdsWithPaperStock = Array.from(
    new Set(
      itemRows
        .filter((item) => item.products?.sku === PAPER_STOCK_SKU)
        .map((item) => item.sales_orders?.id)
        .filter((id): id is string => !!id),
    ),
  );
  const { data: paperCalcRows } = orderIdsWithPaperStock.length
    ? await supabase
        .from("paper_calculations")
        .select("sales_order_id, input_items")
        .in("sales_order_id", orderIdsWithPaperStock)
    : { data: [] as { sales_order_id: string; input_items: unknown }[] };
  const paperCalcSizesByOrderId = new Map<string, PaperCalcSizeRow[]>();
  for (const calc of paperCalcRows ?? []) {
    if (!calc.sales_order_id) continue;
    paperCalcSizesByOrderId.set(
      calc.sales_order_id,
      mergePaperCalcInputItems(
        paperCalcSizesByOrderId.get(calc.sales_order_id) ?? [],
        calc.input_items,
      ),
    );
  }

  // 같은 명세표(sales_order)에 속한 품목은 검색 여부와 상관없이 한 행으로
  // 묶어서 보여준다. 품목이 여러 개면 품목명 칸에 "첫 품목명 외 N건"으로
  // 요약한다. 검색어로 일부 품목만 걸러졌다면(예: 상품명/SKU 검색) 그
  // 매칭된 품목들만 묶여서 "외 N건"에 반영된다.
  const saleRows: DisplayRow[] = Object.values(
    itemRows.reduce<Record<string, DisplayRow & { itemCount: number }>>(
      (acc, item) => {
        const orderId = item.sales_orders?.id ?? item.id;
        const paperCalcSizeLines =
          item.products?.sku === PAPER_STOCK_SKU
            ? formatPaperCalcSizeLines(
                paperCalcSizesByOrderId.get(orderId) ?? [],
              )
            : [];
        const itemDetail: SalesRowItem = {
          productLabel: item.products?.name ?? "-",
          spec: item.spec || item.products?.spec || "-",
          lotNumber: item.lot_number,
          remark: item.remark,
          quantity: item.quantity,
          unit: item.products?.unit,
          unitPrice: Number(item.unit_price),
          supplyAmount: item.supplyAmount,
          taxAmount: item.taxAmount,
          paperCalcSizeLines: paperCalcSizeLines.length
            ? paperCalcSizeLines
            : undefined,
        };
        if (!acc[orderId]) {
          acc[orderId] = {
            key: orderId,
            kind: "sale",
            orderId,
            customerId: item.sales_orders?.customers?.id,
            date: item.sales_orders?.order_date,
            customerName: item.sales_orders?.customers?.name,
            authorName: item.sales_orders?.profiles?.full_name,
            productLabel: item.products?.name ?? "-",
            spec: item.spec || item.products?.spec || "-",
            lotNumber: item.lot_number,
            remark: item.remark,
            quantity: 0,
            unit: item.products?.unit,
            unitPrice: Number(item.unit_price),
            supplyAmount: 0,
            taxAmount: 0,
            deliveryMethod: item.sales_orders?.delivery_method,
            itemCount: 0,
            // 품목이 2건 이상일 때만 드롭다운으로 펼쳐 보여주는 데 쓴다.
            items: [itemDetail],
          };
        } else {
          // 품목이 2건 이상이면 단가/관리번호/비고를 하나로 대표할 수 없으니 비워둔다.
          acc[orderId].unitPrice = null;
          acc[orderId].lotNumber = null;
          acc[orderId].remark = null;
          acc[orderId].items!.push(itemDetail);
        }
        acc[orderId].itemCount += 1;
        acc[orderId].quantity += item.quantity;
        acc[orderId].supplyAmount += item.supplyAmount;
        acc[orderId].taxAmount += item.taxAmount;
        return acc;
      },
      {},
    ),
  ).map((row) => ({
    ...row,
    productLabel:
      row.itemCount > 1
        ? `${row.productLabel} 외 ${row.itemCount - 1}건`
        : row.productLabel,
  }));

  const payments = keyword
    ? rawPayments?.filter(
        (p) =>
          p.customers?.name?.toLowerCase().includes(keyword) ||
          p.memo?.toLowerCase().includes(keyword),
      )
    : rawPayments;
  const collectionRows: DisplayRow[] = (payments ?? []).map((p) => ({
    key: `payment-${p.id}`,
    kind: "collection",
    orderId: undefined,
    customerId: p.customers?.id,
    date: p.paid_at,
    customerName: p.customers?.name,
    authorName: undefined,
    productLabel: p.memo || "수금",
    spec: "-",
    lotNumber: null,
    remark: null,
    quantity: 0,
    unit: undefined,
    unitPrice: null,
    supplyAmount: Number(p.amount),
    taxAmount: 0,
    deliveryMethod: null,
  }));

  const rows: DisplayRow[] = [...saleRows, ...collectionRows].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  const totalSupply = itemRows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = itemRows.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalQuantity = itemRows.reduce((sum, row) => sum + row.quantity, 0);
  const presets = getDatePresets();
  const exportHref = q
    ? `/api/sales/export?q=${encodeURIComponent(q)}`
    : "/api/sales/export";

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
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        매출관리
      </h1>

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
          <label htmlFor="search-from">시작일</label>
          <input
            id="search-from"
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="erp-input"
          />
        </div>
        <div className="erp-field">
          <label htmlFor="search-to">종료일</label>
          <input
            id="search-to"
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="erp-input"
          />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">출고처 / 상품 / 규격 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="출고처명, 상품명, SKU, 규격"
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
          title={
            q
              ? `이번달 "${q}" 검색 결과를 엑셀로 다운로드`
              : "이번달(1일~말일) 전체 내역을 엑셀로 다운로드"
          }
        >
          📥 엑셀 다운로드
        </a>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <SalesGridTable
        rows={rows}
        totalQuantity={totalQuantity}
        totalSupply={totalSupply}
        totalTax={totalTax}
        backParam={backParam ?? ""}
      />
    </div>
  );
}
