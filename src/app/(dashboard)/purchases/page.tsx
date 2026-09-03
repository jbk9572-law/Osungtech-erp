import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDatePresets, previousMonthStart, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { buildListReturnParam } from "@/lib/list-return";
import {
  PurchaseGridTable,
  type PurchaseRow,
  type PurchaseRowItem,
} from "@/components/purchase-grid-table";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { calcVat } from "@/lib/tax";

type DisplayRow = PurchaseRow;

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string }>;
}) {
  const { from, to, q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  // 날짜를 직접 안 걸었으면 지난달 1일부터만 보여준다 — 그 이전 내역은
  // 날짜 필터로 직접 조회한다.
  const effectiveFrom = from || previousMonthStart();
  // 상세 화면에서 ESC/닫기를 누르면 지금 걸어둔 검색/필터로 되돌아오게,
  // 목록 링크에 지금 화면의 쿼리스트링을 실어 보낸다.
  const backParam = buildListReturnParam({ q, from, to, limit: limitParam });
  const supabase = await createClient();

  let query = supabase
    .from("purchase_order_items")
    .select(
      "*, purchase_orders!inner(id, purchase_date, memo, delivery_method, is_carryover, suppliers(id, name), profiles!created_by(full_name)), products(sku, name, spec, unit)",
    )
    // 매입일자(업무상 날짜) 기준으로 최신이 위로 오게 정렬한다. `{ foreignTable }`
    // 옵션은 상위 테이블을 하위 임베드 테이블 값으로 정렬하는 방향으로는
    // 실제로 적용되지 않는 postgrest-js의 알려진 제약이라, PostgREST의
    // `table(column)` 표기를 컬럼명 자리에 직접 써서 우회한다.
    .order("purchase_orders(purchase_date)", { ascending: false })
    .order("created_at", { ascending: false })
    .gte("purchase_orders.purchase_date", effectiveFrom)
    .limit(limit);

  if (to) query = query.lte("purchase_orders.purchase_date", to);

  // 매입 옆에 지급 내역도 같은 목록에 섞어서 보여준다 — sales/page.tsx와
  // 동일한 방식(표시용으로만 합침, 실제 정산은 lib/ar-ap.ts 그대로).
  let paymentQuery = supabase
    .from("supplier_payments")
    .select("id, paid_at, amount, memo, suppliers(id, name)")
    .order("paid_at", { ascending: false })
    .gte("paid_at", effectiveFrom)
    .limit(limit);
  if (to) paymentQuery = paymentQuery.lte("paid_at", to);

  const [{ data: rawItems }, { data: rawPayments }] = await Promise.all([
    query,
    paymentQuery,
  ]);
  // 조회기간 안에 상한(limit)만큼 꽉 채워 왔다면 그 이상 더 있을 수 있다는
  // 뜻이므로 "더보기"를 보여준다.
  const hasMore =
    (rawItems?.length ?? 0) >= limit || (rawPayments?.length ?? 0) >= limit;

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.purchase_orders?.suppliers?.name
            ?.toLowerCase()
            .includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword) ||
          (item.spec || item.products?.spec)?.toLowerCase().includes(keyword),
      )
    : rawItems;

  const itemRows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_cost);
    const taxAmount = calcVat(supplyAmount);
    return { ...item, supplyAmount, taxAmount };
  });

  // 모조지(TG0) 품목 줄이 있는 매입 건만, 그 규격별 배치 내역을 같이
  // 불러와서 드롭다운을 펼쳤을 때 "이 연수가 어떤 규격들로 재단됐는지"
  // 보여준다.
  const orderIdsWithPaperStock = Array.from(
    new Set(
      itemRows
        .filter((item) => item.products?.sku === PAPER_STOCK_SKU)
        .map((item) => item.purchase_orders?.id)
        .filter((id): id is string => !!id),
    ),
  );
  const { data: paperCalcRows } = orderIdsWithPaperStock.length
    ? await supabase
        .from("paper_calculations")
        .select("purchase_order_id, input_items")
        .in("purchase_order_id", orderIdsWithPaperStock)
    : { data: [] as { purchase_order_id: string; input_items: unknown }[] };
  const paperCalcSizesByOrderId = new Map<string, PaperCalcSizeRow[]>();
  for (const calc of paperCalcRows ?? []) {
    if (!calc.purchase_order_id) continue;
    paperCalcSizesByOrderId.set(
      calc.purchase_order_id,
      mergePaperCalcInputItems(
        paperCalcSizesByOrderId.get(calc.purchase_order_id) ?? [],
        calc.input_items,
      ),
    );
  }

  // 같은 매입 건(purchase_order)에 속한 품목은 검색 여부와 상관없이 한 행으로
  // 묶어서 보여준다. 품목이 여러 개면 품목명 칸에 "첫 품목명 외 N건"으로
  // 요약한다. 검색어로 일부 품목만 걸러졌다면(예: 상품명/SKU 검색) 그
  // 매칭된 품목들만 묶여서 "외 N건"에 반영된다.
  const purchaseRows: DisplayRow[] = Object.values(
    itemRows.reduce<Record<string, DisplayRow & { itemCount: number }>>(
      (acc, item) => {
        const orderId = item.purchase_orders?.id ?? item.id;
        const paperCalcSizeLines =
          item.products?.sku === PAPER_STOCK_SKU
            ? formatPaperCalcSizeLines(
                paperCalcSizesByOrderId.get(orderId) ?? [],
              )
            : [];
        const itemDetail: PurchaseRowItem = {
          productLabel: item.products?.name ?? "-",
          spec: item.spec || item.products?.spec || "-",
          lotNumber: item.lot_number,
          remark: item.remark,
          quantity: item.quantity,
          unit: item.products?.unit,
          unitCost: Number(item.unit_cost),
          supplyAmount: item.supplyAmount,
          taxAmount: item.taxAmount,
          paperCalcSizeLines: paperCalcSizeLines.length
            ? paperCalcSizeLines
            : undefined,
        };
        if (!acc[orderId]) {
          acc[orderId] = {
            key: orderId,
            kind: "purchase",
            orderId,
            supplierId: item.purchase_orders?.suppliers?.id,
            date: item.purchase_orders?.purchase_date,
            supplierName: item.purchase_orders?.suppliers?.name,
            authorName: item.purchase_orders?.profiles?.full_name,
            productLabel: item.products?.name ?? "-",
            spec: item.spec || item.products?.spec || "-",
            lotNumber: item.lot_number,
            remark: item.remark,
            quantity: 0,
            unit: item.products?.unit,
            unitCost: Number(item.unit_cost),
            supplyAmount: 0,
            taxAmount: 0,
            deliveryMethod: item.purchase_orders?.delivery_method,
            isCarryover: item.purchase_orders?.is_carryover ?? false,
            itemCount: 0,
            // 품목이 2건 이상일 때만 드롭다운으로 펼쳐 보여주는 데 쓴다.
            items: [itemDetail],
          };
        } else {
          // 품목이 2건 이상이면 단가/관리번호/비고를 하나로 대표할 수 없으니 비워둔다.
          acc[orderId].unitCost = null;
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
          p.suppliers?.name?.toLowerCase().includes(keyword) ||
          p.memo?.toLowerCase().includes(keyword),
      )
    : rawPayments;
  const paymentRows: DisplayRow[] = (payments ?? []).map((p) => ({
    key: `payment-${p.id}`,
    kind: "payment",
    orderId: undefined,
    supplierId: p.suppliers?.id,
    date: p.paid_at,
    supplierName: p.suppliers?.name,
    authorName: undefined,
    productLabel: p.memo || "지급",
    spec: "-",
    lotNumber: null,
    remark: null,
    quantity: 0,
    unit: undefined,
    unitCost: null,
    supplyAmount: Number(p.amount),
    taxAmount: 0,
    deliveryMethod: null,
  }));

  const rows: DisplayRow[] = [...purchaseRows, ...paymentRows].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  // 합계는 위 itemRows(더보기 limit로 잘린 화면 표시용)가 아니라 조회기간
  // 전체를 다시 훑어서 계산한다 — sales/page.tsx와 동일한 이유로, itemRows
  // 기준이면 기간 내 건수가 limit(300)을 넘는 순간 합계가 조용히 줄어든다.
  const totalsRows = await fetchAllRows<{
    quantity: number;
    unit_cost: string | number;
    spec: string | null;
    purchase_orders: { suppliers: { name: string | null } | null } | null;
    products: { name: string | null; sku: string | null; spec: string | null } | null;
  }>((rangeFrom, rangeTo) => {
    let totalsQuery = supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, purchase_orders!inner(suppliers(name)), products(name, sku, spec)",
      )
      .gte("purchase_orders.purchase_date", effectiveFrom)
      .range(rangeFrom, rangeTo);
    if (to) totalsQuery = totalsQuery.lte("purchase_orders.purchase_date", to);
    return totalsQuery;
  });
  const filteredTotalsRows = keyword
    ? totalsRows.filter(
        (item) =>
          item.purchase_orders?.suppliers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword) ||
          (item.spec || item.products?.spec)?.toLowerCase().includes(keyword),
      )
    : totalsRows;

  const totalQuantity = filteredTotalsRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalSupply = filteredTotalsRows.reduce(
    (sum, row) => sum + row.quantity * Number(row.unit_cost),
    0,
  );
  const totalTax = filteredTotalsRows.reduce(
    (sum, row) => sum + calcVat(row.quantity * Number(row.unit_cost)),
    0,
  );
  const presets = getDatePresets();
  const exportHref = q
    ? `/api/purchases/export?q=${encodeURIComponent(q)}`
    : "/api/purchases/export";
  // "더보기"는 같은 조회기간에서 더 많은 줄을 보여주는 게 아니라 조회
  // 시작월을 한 달 더 앞으로 당긴다 — sales/page.tsx와 동일한 이유.
  const effectiveFromMonth = effectiveFrom.slice(0, 7);
  const moreFrom = getMonthRange(shiftMonth(effectiveFromMonth, -1)).from;
  const moreParams = new URLSearchParams();
  moreParams.set("from", moreFrom);
  if (to) moreParams.set("to", to);
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/purchases?${moreParams.toString()}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/purchases/new" },
          F5: { submitFormSelector: "#purchases-search-form" },
          F8: { href: exportHref, newTab: true },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        매입관리
      </h1>

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
          <label htmlFor="search-from">시작일</label>
          <input
            id="search-from"
            type="date"
            name="from"
            defaultValue={from ?? effectiveFrom}
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
          <label htmlFor="search-q">공급처 / 상품 / 규격 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="공급처명, 상품명, SKU, 규격"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q || limitParam) && (
          <Link href="/purchases" className="erp-btn">
            초기화
          </Link>
        )}
      </form>
      <div
        className="rounded p-2 text-xs"
        style={{
          marginBottom: 8,
          background: "var(--erp-info-bg)",
          color: "var(--erp-info-text)",
          border: "1px solid var(--erp-info-border)",
        }}
      >
        {from ? "" : `날짜를 지정하지 않으면 지난달 1일(${effectiveFrom})부터 표시됩니다. `}
        최근 {limit.toLocaleString()}줄까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
      </div>

      <div className="erp-toolbar">
        <Link href="/purchases/new" className="erp-btn erp-btn-primary">
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

      <PurchaseGridTable
        rows={rows}
        totalQuantity={totalQuantity}
        totalSupply={totalSupply}
        totalTax={totalTax}
        backParam={backParam ?? ""}
      />

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link href={moreHref} className="erp-btn">
            더보기 (다음 {LIST_LIMIT_STEP.toLocaleString()}줄)
          </Link>
        </div>
      )}
    </div>
  );
}
