import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getQuickDatePresets, getYearMonthButtons, defaultListRange, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { monthRangeOf } from "@/lib/carryover";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { buildListReturnParam } from "@/lib/list-return";
import {
  PurchaseGridTable,
  type PurchaseRow,
  type PurchaseRowItem,
} from "@/components/purchase-grid-table";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { PageGuide } from "@/components/erp/page-guide";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { calcVat } from "@/lib/tax";
import { matchesSearch } from "@/lib/search-match";
import { formatNumber } from "@/lib/format-number";
import { ExcelDownloadLink } from "@/components/erp/excel-download-link";

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
  // 날짜를 직접 안 걸었으면 "이번달" 프리셋과 똑같이 이번달 1일~말일을
  // 보여준다 — 그 이전 내역은 프리셋/날짜 필터로 직접 조회한다.
  const { from: effectiveFrom, to: effectiveTo } = defaultListRange(from, to);
  // 상세 화면에서 ESC/닫기를 누르면 지금 걸어둔 검색/필터로 되돌아오게,
  // 목록 링크에 지금 화면의 쿼리스트링을 실어 보낸다.
  const backParam = buildListReturnParam({ q, from, to, limit: limitParam });
  const supabase = await createClient();

  // 전월 이월분 구간에서도 똑같은 모양의 행을 그릴 수 있게, select 문자열을
  // 상수로 빼서 두 쿼리가 같은 타입으로 추론되게 한다(아래
  // carryoverQuery 참고).
  const PURCHASE_ITEM_SELECT =
    "*, purchase_orders!inner(id, purchase_date, memo, delivery_method, is_carryover, doc_no, tax_type, evidence_type, suppliers(id, name, supplier_code), profiles!created_by(full_name)), products(sku, name, spec, unit)";

  // 지금 보는 조회기간이 "정확히 한 달 전체"일 때만 "전월 이월분" 구간을
  // 추가로 보여준다 — sales/page.tsx와 같은 이유(임의 기간엔 "전월"이란
  // 개념이 없다).
  const viewedMonth = monthRangeOf(effectiveFrom, effectiveTo);
  const carryoverRange = viewedMonth ? getMonthRange(shiftMonth(viewedMonth, -1)) : null;

  const keyword = q?.trim().toLowerCase();

  // 매입일자(업무상 날짜) 기준으로 최신이 위로 오게 정렬한다.
  // `{ foreignTable }` 옵션은 상위 테이블을 하위 임베드 테이블 값으로
  // 정렬하는 방향으로는 실제로 적용되지 않는 postgrest-js의 알려진
  // 제약이라, PostgREST의 `table(column)` 표기를 컬럼명 자리에 직접
  // 써서 우회한다.
  const buildItemQuery = () =>
    supabase
      .from("purchase_order_items")
      .select(PURCHASE_ITEM_SELECT)
      .order("purchase_orders(purchase_date)", { ascending: false })
      .order("created_at", { ascending: false })
      .gte("purchase_orders.purchase_date", effectiveFrom)
      .lte("purchase_orders.purchase_date", effectiveTo);

  // 매입 옆에 지급 내역도 같은 목록에 섞어서 보여준다 — sales/page.tsx와
  // 동일한 방식(표시용으로만 합침, 실제 정산은 lib/ar-ap.ts 그대로).
  const buildPaymentQuery = () =>
    supabase
      .from("supplier_payments")
      .select("id, paid_at, amount, memo, suppliers(id, name)")
      .order("paid_at", { ascending: false })
      .gte("paid_at", effectiveFrom)
      .lte("paid_at", effectiveTo);

  const buildCarryoverQuery = (range: { from: string; to: string }) =>
    supabase
      .from("purchase_order_items")
      .select(PURCHASE_ITEM_SELECT)
      .eq("purchase_orders.is_carryover", true)
      .order("purchase_orders(purchase_date)", { ascending: false })
      .gte("purchase_orders.purchase_date", range.from)
      .lte("purchase_orders.purchase_date", range.to);

  const receivedInvoiceRows = await fetchAllRows<{ purchase_order_id: string }>((from, to) =>
    supabase
      .from("purchase_received_invoices")
      .select("purchase_order_id")
      .not("purchase_order_id", "is", null)
      .range(from, to),
  );
  const receivedPurchaseOrderIds = new Set(receivedInvoiceRows.map((r) => r.purchase_order_id));

  // 검색어(q)가 있으면 "지금 화면에 보이는 limit건" 안에서만 찾는 게
  // 아니라 조회기간 전체에서 찾아야 한다 — sales/page.tsx와 같은 이유로
  // 같은 버그가 있었다(사용자 지적 — "작성자가 다른 건은 조회가 안
  // 된다"). 검색 중일 때만 fetchAllRows로 조회기간 전체를 받고, 검색이
  // 없을 때는 기존처럼 DB에서 최근 limit건만 받아 일반 조회 성능을
  // 그대로 유지한다.
  const [rawItems, rawPayments, rawCarryoverItems] = await Promise.all([
    keyword
      ? fetchAllRows((from, to) => buildItemQuery().range(from, to))
      : buildItemQuery()
          .limit(limit)
          .then((r) => r.data ?? []),
    keyword
      ? fetchAllRows((from, to) => buildPaymentQuery().range(from, to))
      : buildPaymentQuery()
          .limit(limit)
          .then((r) => r.data ?? []),
    carryoverRange
      ? keyword
        ? fetchAllRows((from, to) => buildCarryoverQuery(carryoverRange).range(from, to))
        : buildCarryoverQuery(carryoverRange)
            .limit(limit)
            .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const items = keyword
    ? rawItems.filter((item) =>
        matchesSearch(
          keyword,
          item.purchase_orders?.suppliers?.name,
          item.products?.name,
          item.custom_name,
          item.products?.sku,
          item.spec || item.products?.spec,
          item.lot_number,
          item.remark,
          item.purchase_orders?.memo,
          item.purchase_orders?.delivery_method,
        ),
      )
    : rawItems;
  // "더보기"는 검색 중이 아닐 때만 의미가 있다 — sales/page.tsx와 같은
  // 이유.
  const hasMore =
    !keyword && (rawItems.length >= limit || rawPayments.length >= limit);

  const itemRows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_cost);
    const taxAmount =
      item.purchase_orders?.tax_type === "과세" ? calcVat(supplyAmount) : 0;
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
          productLabel: item.products?.name ?? item.custom_name ?? "-",
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
            docNo: item.purchase_orders?.doc_no,
            supplierCode: item.purchase_orders?.suppliers?.supplier_code,
            taxType: item.purchase_orders?.tax_type,
            evidenceType: item.purchase_orders?.evidence_type,
            invoiceReceived: receivedPurchaseOrderIds.has(orderId),
            date: item.purchase_orders?.purchase_date,
            supplierName: item.purchase_orders?.suppliers?.name,
            authorName: item.purchase_orders?.profiles?.full_name,
            productLabel: item.products?.name ?? item.custom_name ?? "-",
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

  // 전월 이월분 — 작업일(매입일자)은 전월이지만 다음 달(지금 보고 있는 달)
  // 실적으로 잡히는 건. sales/page.tsx와 같은 이유로 목록에도 보여준다.
  // 모조지 재단 상세(paperCalcSizeLines)까지는 채우지 않는다 — 참고용
  // 구간이고, 필요하면 상세 화면에서 그대로 볼 수 있다.
  const carryoverKeywordItems = keyword
    ? (rawCarryoverItems ?? []).filter((item) =>
        matchesSearch(
          keyword,
          item.purchase_orders?.suppliers?.name,
          item.products?.name,
          item.custom_name,
          item.products?.sku,
          item.spec || item.products?.spec,
          item.lot_number,
          item.remark,
          item.purchase_orders?.memo,
          item.purchase_orders?.delivery_method,
        ),
      )
    : (rawCarryoverItems ?? []);
  const carryoverItemRows = carryoverKeywordItems.map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_cost);
    const taxAmount = item.purchase_orders?.tax_type === "과세" ? calcVat(supplyAmount) : 0;
    return { ...item, supplyAmount, taxAmount };
  });
  const carryoverRows: DisplayRow[] = Object.values(
    carryoverItemRows.reduce<Record<string, DisplayRow & { itemCount: number }>>((acc, item) => {
      const orderId = item.purchase_orders?.id ?? item.id;
      if (!acc[orderId]) {
        acc[orderId] = {
          key: orderId,
          kind: "purchase",
          orderId,
          supplierId: item.purchase_orders?.suppliers?.id,
          docNo: item.purchase_orders?.doc_no,
          supplierCode: item.purchase_orders?.suppliers?.supplier_code,
          taxType: item.purchase_orders?.tax_type,
          evidenceType: item.purchase_orders?.evidence_type,
          invoiceReceived: receivedPurchaseOrderIds.has(orderId),
          date: item.purchase_orders?.purchase_date,
          supplierName: item.purchase_orders?.suppliers?.name,
          authorName: item.purchase_orders?.profiles?.full_name,
          productLabel: item.products?.name ?? item.custom_name ?? "-",
          spec: item.spec || item.products?.spec || "-",
          lotNumber: item.lot_number,
          remark: item.remark,
          quantity: 0,
          unit: item.products?.unit,
          unitCost: Number(item.unit_cost),
          supplyAmount: 0,
          taxAmount: 0,
          deliveryMethod: item.purchase_orders?.delivery_method,
          isCarryover: true,
          itemCount: 0,
        };
      } else {
        acc[orderId].unitCost = null;
        acc[orderId].lotNumber = null;
        acc[orderId].remark = null;
      }
      acc[orderId].itemCount += 1;
      acc[orderId].quantity += item.quantity;
      acc[orderId].supplyAmount += item.supplyAmount;
      acc[orderId].taxAmount += item.taxAmount;
      return acc;
    }, {}),
  ).map((row) => ({
    ...row,
    productLabel: row.itemCount > 1 ? `${row.productLabel} 외 ${row.itemCount - 1}건` : row.productLabel,
  }));
  const carryoverQuantityTotal = carryoverRows.reduce((sum, r) => sum + r.quantity, 0);
  const carryoverSupplyTotal = carryoverRows.reduce((sum, r) => sum + r.supplyAmount, 0);
  const carryoverTaxTotal = carryoverRows.reduce((sum, r) => sum + r.taxAmount, 0);

  const payments = keyword
    ? rawPayments?.filter((p) => matchesSearch(keyword, p.suppliers?.name, p.memo))
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
    lot_number: string | null;
    remark: string | null;
    custom_name: string | null;
    purchase_orders: {
      memo: string | null;
      delivery_method: string | null;
      tax_type: "과세" | "면세" | "영세";
      suppliers: { name: string | null } | null;
    } | null;
    products: { name: string | null; sku: string | null; spec: string | null } | null;
  }>((rangeFrom, rangeTo) => {
    let totalsQuery = supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, lot_number, remark, custom_name, purchase_orders!inner(memo, delivery_method, tax_type, suppliers(name)), products(name, sku, spec)",
      )
      .gte("purchase_orders.purchase_date", effectiveFrom)
      .range(rangeFrom, rangeTo);
    totalsQuery = totalsQuery.lte("purchase_orders.purchase_date", effectiveTo);
    return totalsQuery;
  });
  const filteredTotalsRows = keyword
    ? totalsRows.filter((item) =>
        matchesSearch(
          keyword,
          item.purchase_orders?.suppliers?.name,
          item.products?.name,
          item.custom_name,
          item.products?.sku,
          item.spec || item.products?.spec,
          item.lot_number,
          item.remark,
          item.purchase_orders?.memo,
          item.purchase_orders?.delivery_method,
        ),
      )
    : totalsRows;

  const totalQuantity = filteredTotalsRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalSupply = filteredTotalsRows.reduce(
    (sum, row) => sum + row.quantity * Number(row.unit_cost),
    0,
  );
  const totalTax = filteredTotalsRows.reduce(
    (sum, row) =>
      row.purchase_orders?.tax_type === "과세"
        ? sum + calcVat(row.quantity * Number(row.unit_cost))
        : sum,
    0,
  );
  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();
  const exportHref = q
    ? `/api/purchases/export?q=${encodeURIComponent(q)}`
    : "/api/purchases/export";
  // "더보기"는 같은 조회기간에서 더 많은 줄을 보여주는 게 아니라 조회
  // 시작월을 한 달 더 앞으로 당긴다 — sales/page.tsx와 동일한 이유.
  const effectiveFromMonth = effectiveFrom.slice(0, 7);
  const moreFrom = getMonthRange(shiftMonth(effectiveFromMonth, -1)).from;
  const moreParams = new URLSearchParams();
  moreParams.set("from", moreFrom);
  moreParams.set("to", to || effectiveTo);
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
      <ListPageHeader title="매입관리" />

      <DateRangeQuickFilters
        basePath="/purchases"
        presets={presets}
        monthButtons={monthButtons}
        from={effectiveFrom}
        to={effectiveTo}
      />

      <form method="get" id="purchases-search-form" className="erp-field-grid">
        <div className="erp-field erp-span-2">
          <label htmlFor="search-from">시작일</label>
          <input
            id="search-from"
            type="date"
            name="from"
            defaultValue={from ?? effectiveFrom}
            className="erp-input"
          />
        </div>
        <div className="erp-field erp-span-2">
          <label htmlFor="search-to">종료일</label>
          <input
            id="search-to"
            type="date"
            name="to"
            defaultValue={to ?? effectiveTo}
            className="erp-input"
          />
        </div>
        <div className="erp-field erp-span-6">
          <label htmlFor="search-q">공급처 / 상품 / 규격 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="공급처명, 상품명, SKU, 규격, 관리번호, 배송방법, 메모, 비고"
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
      <PageGuide>
        {from ? "" : `날짜를 지정하지 않으면 이번달(${effectiveFrom} ~ ${effectiveTo})만 표시됩니다. `}
        최근 {formatNumber(limit)}줄까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
      </PageGuide>

      <div className="erp-toolbar">
        <Link href="/purchases/new" className="erp-btn erp-btn-primary">
          F2 신규
        </Link>
        <ExcelDownloadLink
          href={exportHref}
          title={q ? `이번달 "${q}" 검색 결과를 엑셀로 다운로드` : "이번달(1일~말일) 전체 내역을 엑셀로 다운로드"}
        />
        <Link href="/purchases/tax-invoices/import" className="erp-btn" title="홈택스 매입내역 엑셀을 업로드해 세금계산서 수취 여부를 매칭">
          📤 매입세금계산서 수취 관리
        </Link>
      </div>

      {carryoverRows.length > 0 && (
        <PageGuide tone="info" className="mb-2">
          이번 달 매입 실적(리포트 기준) = 신규 {formatNumber(totalSupply)}원 + 전월 이월{" "}
          {formatNumber(carryoverSupplyTotal)}원 = <strong>{formatNumber(totalSupply + carryoverSupplyTotal)}원</strong>{" "}
          — 전월 이월분은 아래 목록 합계(날짜 기준)에는 포함되지 않고, 별도 구간으로만 표시됩니다.
        </PageGuide>
      )}

      <PurchaseGridTable
        rows={rows}
        totalQuantity={totalQuantity}
        totalSupply={totalSupply}
        totalTax={totalTax}
        backParam={backParam ?? ""}
        carryoverRows={carryoverRows}
        carryoverQuantity={carryoverQuantityTotal}
        carryoverSupply={carryoverSupplyTotal}
        carryoverTax={carryoverTaxTotal}
      />

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link href={moreHref} className="erp-btn">
            더보기 (다음 {formatNumber(LIST_LIMIT_STEP)}줄)
          </Link>
        </div>
      )}
    </div>
  );
}
