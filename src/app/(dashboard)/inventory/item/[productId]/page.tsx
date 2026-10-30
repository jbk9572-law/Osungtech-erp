import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient } from "@/lib/supabase/server";
import { getQuickDatePresets, getYearMonthButtons, defaultListRange } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { ClickableRow } from "@/components/clickable-row";
import { QtyWithBoxes } from "@/components/qty-with-boxes";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { GridBadge } from "@/components/grid/badge";
import { DetailPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { groupOrderCorrections, type InventoryHistoryRow } from "@/lib/inventory-history-grouping";
import { formatNumber } from "@/lib/format-number";

// 주소가 /inventory/item/[productId]인 이유: 재고관리 하위에는 이 상세
// 화면 말고도 count, qr-labels, warehouses 같은 정적 형제 메뉴가 여럿
// 있는데, 예전엔 이 동적 세그먼트가 /inventory 바로 밑에 있어서 @modal
// 인터셉트 라우트가 "qr-labels" 같은 정적 경로명까지 productId 값으로
// 착각해 가로채는 문제가 반복됐다(개별 정적 pass-through로 땜질했다가
// 오히려 새 회귀를 두 번 만든 전례가 있음). item/ 한 단계를 더 넣어
// 동적 세그먼트를 정적 형제들과 완전히 분리했다 — 이제 구조적으로
// 충돌이 불가능하다. isUuid() 가드는 그와 별개로 잘못된 주소(수동 입력
// 등) 방어용으로 남겨둔다.
export default async function InventoryProductHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { productId } = await params;
  if (!isUuid(productId)) notFound();
  const { from: fromParam, to: toParam } = await searchParams;
  const supabase = await createClient();

  // 날짜를 직접 안 걸었으면 매출/매입 목록과 같은 기본값(이번달)을 쓴다
  // — 예전엔 기본이 "전체 이력"이라, 거래가 많이 쌓인 인기 품목일수록
  // 상세 화면을 열 때마다 처음부터 끝까지 풀스캔해서 느려졌다. 잔량은
  // get_product_ledger_rows RPC가 DB 안에서 거래일자(transaction_date)
  // 오름차순 + 창고별 재고실사 리셋을 반영해 정확히 계산해 돌려준다(이
  // 화면 자체가 전체 창고 합산 기준이라 p_warehouse_id는 비워둔다) —
  // created_at(시스템 입력시각) 순서로 계산하면 전표를 늦게/일찍 입력했을
  // 때 중간 잔량이 틀어지는 버그가 있었다(자세한 설명은 그 RPC의
  // 마이그레이션 주석 참고).
  const { from, to } = defaultListRange(fromParam, toParam);

  const [{ data: product }, { data: ledgerRowsRaw }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, sku, name, spec, unit, reorder_point, base_package_qty, inventory(quantity)",
      )
      .eq("id", productId)
      .maybeSingle(),
    supabase.rpc("get_product_ledger_rows", {
      p_product_id: productId,
      p_from: from,
      p_to: to,
    }),
  ]);

  if (!product) {
    notFound();
  }

  const ledgerRows = ledgerRowsRaw ?? [];

  // 관리번호(lot)와 거래처명은 inventory_transactions/RPC 결과에 직접
  // 없고 각각 전표 품목줄(sales_order_items/purchase_order_items)과
  // 전표 헤더(sales_orders.customers/purchase_orders.suppliers)에 있다 —
  // 이번달(선택한 기간) 조회분에 실제로 등장하는 전표ID만 추려서 그만큼만
  // 찾는다(품목 전체 역사의 전표를 다 긁어올 필요 없음).
  const saleOrderIds = Array.from(new Set(ledgerRows.map((t) => t.sales_order_id).filter((id): id is string => !!id)));
  const purchaseOrderIds = Array.from(
    new Set(ledgerRows.map((t) => t.purchase_order_id).filter((id): id is string => !!id)),
  );
  const authorIds = Array.from(new Set(ledgerRows.map((t) => t.created_by).filter((id): id is string => !!id)));
  const [saleLotRows, purchaseLotRows, saleOrderRows, purchaseOrderRows, authorRows] = await Promise.all([
    saleOrderIds.length
      ? fetchAllRows<{ sales_order_id: string; lot_number: string | null }>((f, t) =>
          supabase
            .from("sales_order_items")
            .select("sales_order_id, lot_number")
            .eq("product_id", productId)
            .in("sales_order_id", saleOrderIds)
            .range(f, t),
        )
      : Promise.resolve([]),
    purchaseOrderIds.length
      ? fetchAllRows<{ purchase_order_id: string; lot_number: string | null }>((f, t) =>
          supabase
            .from("purchase_order_items")
            .select("purchase_order_id, lot_number")
            .eq("product_id", productId)
            .in("purchase_order_id", purchaseOrderIds)
            .range(f, t),
        )
      : Promise.resolve([]),
    saleOrderIds.length
      ? fetchAllRows<{ id: string; customers: { name: string | null } | null }>((f, t) =>
          supabase.from("sales_orders").select("id, customers(name)").in("id", saleOrderIds).range(f, t),
        )
      : Promise.resolve([]),
    purchaseOrderIds.length
      ? fetchAllRows<{ id: string; suppliers: { name: string | null } | null }>((f, t) =>
          supabase.from("purchase_orders").select("id, suppliers(name)").in("id", purchaseOrderIds).range(f, t),
        )
      : Promise.resolve([]),
    authorIds.length
      ? fetchAllRows<{ id: string; full_name: string | null }>((f, t) =>
          supabase.from("profiles").select("id, full_name").in("id", authorIds).range(f, t),
        )
      : Promise.resolve([]),
  ]);

  const lotBySalesOrderId = new Map(saleLotRows.map((r) => [r.sales_order_id, r.lot_number]));
  const lotByPurchaseOrderId = new Map(purchaseLotRows.map((r) => [r.purchase_order_id, r.lot_number]));
  const customerNameBySalesOrderId = new Map(saleOrderRows.map((r) => [r.id, r.customers?.name ?? null]));
  const supplierNameByPurchaseOrderId = new Map(purchaseOrderRows.map((r) => [r.id, r.suppliers?.name ?? null]));
  const authorNameById = new Map(authorRows.map((r) => [r.id, r.full_name]));

  const allTx: InventoryHistoryRow[] = ledgerRows.map((t) => ({
    id: t.id,
    date: t.transaction_date,
    type: t.type,
    signedQty: t.type === "out" ? -Math.abs(t.quantity) : t.quantity,
    partnerName:
      (t.sales_order_id ? customerNameBySalesOrderId.get(t.sales_order_id) : null) ??
      (t.purchase_order_id ? supplierNameByPurchaseOrderId.get(t.purchase_order_id) : null) ??
      null,
    note: t.note,
    reference: t.reference,
    href: t.sales_order_id
      ? `/sales/${t.sales_order_id}`
      : t.purchase_order_id
        ? `/purchases/${t.purchase_order_id}`
        : null,
    balance: t.balance_after,
    authorName: (t.created_by ? authorNameById.get(t.created_by) : null) ?? null,
    lotNumber: t.sales_order_id
      ? (lotBySalesOrderId.get(t.sales_order_id) ?? null)
      : t.purchase_order_id
        ? (lotByPurchaseOrderId.get(t.purchase_order_id) ?? null)
        : null,
  }));

  // 전표 수정으로 생긴 되돌림/재반영 여러 줄을, 정확히 같은 전표 ID일
  // 때만(추측 없이) 최신 줄 하나로 합친다 — inventory-history-grouping.ts 참고.
  const groupedTx = groupOrderCorrections(allTx);

  // get_product_ledger_rows가 이미 거래일자(transaction_date) 기준으로
  // [from, to] 안의 행만 돌려준다 — 화면 표시는 최신이 위로 오게 뒤집는다.
  const rows = groupedTx.slice().reverse();
  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();
  // 창고가 여러 개면 [0]은 임의의 창고 하나만 가리켜, 아래 표에 보이는
  // (모든 창고 입출고를 합산한) 재고 잔량과 값이 어긋날 수 있었다.
  const currentQuantity = (product.inventory ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0);

  // 재고실사(submitStockCount)가 남긴 조정만 골라서 최근 편차 이력을
  // 별도로 보여준다 — 아래 전체 입출고내역 표에도 같은 행이 섞여 있지만,
  // 이 품목이 실사 때마다 반복해서 틀리는지는 전체 표에 파묻혀서는 눈에
  // 안 띈다. 3회 이상이면 "반복 편차"로 눈에 띄게 표시한다.
  const countAdjustments = allTx
    .filter((t) => t.reference?.startsWith("stock_count:"))
    .slice()
    .reverse();
  const isRepeatedMiss = countAdjustments.length >= 3;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <DetailPageHeader
        title="재고관리 > 재고현황 > 입출고내역"
        meta={
          <>
            {product.sku} · {product.name}
            {product.spec && ` (${product.spec})`} · 현재 재고{" "}
            <QtyWithBoxes quantity={currentQuantity} basePackageQty={product.base_package_qty} />
            {product.unit ?? ""}
          </>
        }
      />

      {countAdjustments.length > 0 && (
        <div
          className="erp-detail"
          style={{ marginTop: 0, marginBottom: 14, borderColor: isRepeatedMiss ? "var(--erp-warning)" : undefined }}
        >
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active" style={{ borderRight: "none", cursor: "default" }}>
              최근 실사 편차 이력
            </span>
            {isRepeatedMiss && (
              <GridBadge
                tone="warn"
                style={{ marginLeft: "auto", marginRight: 12, alignSelf: "center" }}
              >
                반복 편차 {countAdjustments.length}회
              </GridBadge>
            )}
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap has-card-view">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>실사일</th>
                    <th className="num" style={{ width: 90 }}>
                      차이
                    </th>
                    <th>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {countAdjustments.map((t) => (
                    <tr key={t.id}>
                      <td>{new Date(t.date).toLocaleDateString("ko-KR")}</td>
                      <td
                        className="num"
                        style={{ fontWeight: 700, color: t.signedQty > 0 ? "var(--erp-success)" : "var(--erp-danger)" }}
                      >
                        {t.signedQty > 0 ? "+" : ""}
                        {formatNumber(t.signedQty)}
                      </td>
                      <td style={{ color: "var(--erp-text-muted)" }}>
                        {t.note?.replace(/^재고실사(: )?/, "") || "사유 기록 없음"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-row-card-list">
              {countAdjustments.map((t) => (
                <div className="erp-row-card" key={t.id}>
                  <div className="erp-row-card-head">
                    <span className="erp-row-card-partner">{new Date(t.date).toLocaleDateString("ko-KR")}</span>
                    <span
                      className="erp-row-card-amount"
                      style={{ color: t.signedQty > 0 ? "var(--erp-success)" : "var(--erp-danger)" }}
                    >
                      {t.signedQty > 0 ? "+" : ""}
                      {formatNumber(t.signedQty)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--erp-font-sm)", color: "var(--erp-text-muted)" }}>
                    {t.note?.replace(/^재고실사(: )?/, "") || "사유 기록 없음"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="erp-toolbar">
        <CloseButton href="/inventory">ESC 목록으로</CloseButton>
      </div>

      <DateRangeQuickFilters
        basePath={`/inventory/item/${productId}`}
        presets={presets}
        monthButtons={monthButtons}
        from={from}
        to={to}
      />

      <form method="get" className="erp-field-grid">
        <div className="erp-field erp-span-2">
          <label>시작일</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="erp-input"
          />
        </div>
        <div className="erp-field erp-span-2">
          <label>종료일</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="erp-input"
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(fromParam || toParam) && (
          <Link href={`/inventory/item/${productId}`} className="erp-btn">
            초기화
          </Link>
        )}
      </form>
      <PageGuide>
        {fromParam ? "" : `날짜를 지정하지 않으면 이번달(${from} ~ ${to})만 표시됩니다. `}
        재고 잔량은 조회기간 시작 시점의 누적 재고(이월)부터 정확히 반영됩니다.
      </PageGuide>

      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>날짜</th>
              <th>입고처</th>
              <th className="num">입고</th>
              <th>출고처</th>
              <th className="num">출고</th>
              <th>관리번호</th>
              <th>비고</th>
              <th>작성자</th>
              <th className="num">재고 잔량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isIn = row.signedQty > 0;
              const note = row.correctionNote ?? row.note;
              const cells = (
                <>
                  <td>{new Date(row.date).toLocaleDateString("ko-KR")}</td>
                  <td>{isIn ? (row.partnerName ?? "-") : <span style={{ color: "var(--erp-text-muted)" }}>-</span>}</td>
                  <td className="num" style={{ color: isIn ? "var(--erp-success)" : "var(--erp-text-muted)", fontWeight: isIn ? 700 : undefined }}>
                    {isIn ? formatNumber(Math.abs(row.signedQty)) : "-"}
                  </td>
                  <td>{!isIn ? (row.partnerName ?? "-") : <span style={{ color: "var(--erp-text-muted)" }}>-</span>}</td>
                  <td className="num" style={{ color: !isIn ? "var(--erp-danger)" : "var(--erp-text-muted)", fontWeight: !isIn ? 700 : undefined }}>
                    {!isIn ? formatNumber(Math.abs(row.signedQty)) : "-"}
                  </td>
                  <td>
                    {row.lotNumber ? (
                      <Link
                        href={`/inventory/lot-lookup?q=${encodeURIComponent(row.lotNumber)}`}
                        className="erp-badge erp-badge-muted"
                        style={{ textDecoration: "none" }}
                      >
                        {row.lotNumber}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--erp-text-muted)" }}>-</span>
                    )}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {note || "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.authorName ?? "-"}
                  </td>
                  <td className="num">
                    <QtyWithBoxes quantity={row.balance} basePackageQty={product.base_package_qty} />
                  </td>
                </>
              );
              return row.href ? (
                <ClickableRow key={row.id} href={row.href}>
                  {cells}
                </ClickableRow>
              ) : (
                <tr key={row.id}>{cells}</tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="erp-grid-empty">
                  조건에 맞는 입출고 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="erp-row-card-list">
        {rows.map((row) => {
          const isIn = row.signedQty > 0;
          const note = row.correctionNote ?? row.note;
          const body = (
            <>
              <div className="erp-row-card-head">
                <span className="erp-row-card-partner">{row.partnerName ?? "-"}</span>
                <span className="erp-row-card-date">{new Date(row.date).toLocaleDateString("ko-KR")}</span>
              </div>
              <dl className="erp-order-item-fields">
                <div>
                  <dt>{isIn ? "입고" : "출고"}</dt>
                  <dd style={{ fontWeight: 700, color: isIn ? "var(--erp-success)" : "var(--erp-danger)" }}>
                    {formatNumber(Math.abs(row.signedQty))}
                  </dd>
                </div>
                <div>
                  <dt>재고 잔량</dt>
                  <dd>
                    <QtyWithBoxes quantity={row.balance} basePackageQty={product.base_package_qty} />
                  </dd>
                </div>
                <div>
                  <dt>관리번호</dt>
                  <dd>
                    {row.lotNumber ? (
                      <span className="erp-badge erp-badge-muted">{row.lotNumber}</span>
                    ) : (
                      "-"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>작성자</dt>
                  <dd>{row.authorName ?? "-"}</dd>
                </div>
                {note && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <dt>비고</dt>
                    <dd>{note}</dd>
                  </div>
                )}
              </dl>
            </>
          );
          return row.href ? (
            <Link key={row.id} href={row.href} className="erp-row-card">
              {body}
            </Link>
          ) : (
            <div key={row.id} className="erp-row-card">
              {body}
            </div>
          );
        })}
        {!rows.length && <p className="erp-grid-empty">조건에 맞는 입출고 내역이 없습니다.</p>}
      </div>
    </div>
  );
}
