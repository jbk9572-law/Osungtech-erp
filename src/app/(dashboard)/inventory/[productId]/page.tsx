import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ClickableRow } from "@/components/clickable-row";
import { QtyWithBoxes } from "@/components/qty-with-boxes";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { groupOrderCorrections, type InventoryHistoryRow } from "@/lib/inventory-history-grouping";

export default async function InventoryProductHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { productId } = await params;
  const { from, to } = await searchParams;
  const supabase = await createClient();

  const [{ data: product }, txRaw, saleLotRows, purchaseLotRows] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, sku, name, spec, unit, reorder_point, base_package_qty, inventory(quantity)",
      )
      .eq("id", productId)
      .maybeSingle(),
    // 재고 잔량은 전체 이력을 처음부터 누적해야 정확하다. 예전에는 여기
    // limit(1000)이 있었는데, 오름차순 정렬 + limit 조합이라 거래가 1000건을
    // 넘는 순간 정작 최신 거래가 잘려서 화면에도 안 보이고 잔량 계산도
    // 틀어지는 문제가 있었다(오래된 거래는 남고 최신 거래가 사라짐). 그
    // limit을 없앤 뒤에도 PostgREST의 max_rows(1000, supabase/config.toml)가
    // 여전히 조용히 같은 상한을 적용하므로, fetchAllRows로 전량을 받아온다.
    fetchAllRows<{
      id: string;
      type: string;
      quantity: number;
      note: string | null;
      reference: string | null;
      created_at: string;
      sales_order_id: string | null;
      purchase_order_id: string | null;
      sales_orders: { order_date: string; customers: { name: string | null } | null } | null;
      purchase_orders: { purchase_date: string; suppliers: { name: string | null } | null } | null;
      profiles: { full_name: string | null } | null;
    }>((from, to) =>
      supabase
        .from("inventory_transactions")
        .select(
          "id, type, quantity, note, reference, created_at, sales_order_id, purchase_order_id, sales_orders(order_date, customers(name)), purchase_orders(purchase_date, suppliers(name)), profiles!created_by(full_name)",
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    // 관리번호는 inventory_transactions에 직접 없고 그 전표의 품목 줄
    // (sales_order_items/purchase_order_items)에 있다 — 이 품목 기준으로
    // 미리 전표ID→관리번호 맵을 만들어둔다(되돌림 줄은 전표ID 연결이
    // 없어 관리번호도 없지만, 합쳐지는 앵커/최초 줄 쪽에서 채워진다).
    fetchAllRows<{ sales_order_id: string; lot_number: string | null }>((from, to) =>
      supabase
        .from("sales_order_items")
        .select("sales_order_id, lot_number")
        .eq("product_id", productId)
        .range(from, to),
    ),
    fetchAllRows<{ purchase_order_id: string; lot_number: string | null }>((from, to) =>
      supabase
        .from("purchase_order_items")
        .select("purchase_order_id, lot_number")
        .eq("product_id", productId)
        .range(from, to),
    ),
  ]);

  if (!product) {
    notFound();
  }

  const lotBySalesOrderId = new Map(saleLotRows.map((r) => [r.sales_order_id, r.lot_number]));
  const lotByPurchaseOrderId = new Map(purchaseLotRows.map((r) => [r.purchase_order_id, r.lot_number]));

  const allTx = txRaw.reduce<InventoryHistoryRow[]>((acc, t) => {
    const date =
      t.sales_orders?.order_date ??
      t.purchase_orders?.purchase_date ??
      t.created_at.slice(0, 10);
    const signedQty = t.type === "out" ? -Math.abs(t.quantity) : t.quantity;
    const balance = (acc.at(-1)?.balance ?? 0) + signedQty;
    acc.push({
      id: t.id,
      date,
      type: t.type,
      signedQty,
      partnerName:
        t.sales_orders?.customers?.name ??
        t.purchase_orders?.suppliers?.name ??
        null,
      note: t.note,
      reference: t.reference,
      href: t.sales_order_id
        ? `/sales/${t.sales_order_id}`
        : t.purchase_order_id
          ? `/purchases/${t.purchase_order_id}`
          : null,
      balance,
      authorName: t.profiles?.full_name ?? null,
      lotNumber: t.sales_order_id
        ? (lotBySalesOrderId.get(t.sales_order_id) ?? null)
        : t.purchase_order_id
          ? (lotByPurchaseOrderId.get(t.purchase_order_id) ?? null)
          : null,
    });
    return acc;
  }, []);

  // 전표 수정으로 생긴 되돌림/재반영 여러 줄을, 정확히 같은 전표 ID일
  // 때만(추측 없이) 최신 줄 하나로 합친다 — inventory-history-grouping.ts 참고.
  const groupedTx = groupOrderCorrections(allTx);

  const rows = groupedTx
    .filter((t) => (!from || t.date >= from) && (!to || t.date <= to))
    .reverse();
  const presets = getDatePresets();
  const currentQuantity = product.inventory?.[0]?.quantity ?? 0;

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
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">
        재고관리 &gt; 재고현황 &gt; 입출고내역
      </h1>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        {product.sku} · {product.name}
        {product.spec && ` (${product.spec})`} · 현재 재고{" "}
        <QtyWithBoxes quantity={currentQuantity} basePackageQty={product.base_package_qty} />
        {product.unit ?? ""}
      </p>

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
              <span
                className="erp-badge erp-badge-warning"
                style={{ marginLeft: "auto", marginRight: 12, alignSelf: "center" }}
              >
                반복 편차 {countAdjustments.length}회
              </span>
            )}
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
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
                        {t.signedQty.toLocaleString()}
                      </td>
                      <td style={{ color: "var(--erp-text-muted)" }}>
                        {t.note?.replace(/^재고실사(: )?/, "") || "사유 기록 없음"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="erp-toolbar">
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
      </div>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/inventory/${productId}?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <form method="get" className="erp-search">
        <div className="erp-field">
          <label>시작일</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="erp-input"
          />
        </div>
        <div className="erp-field">
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
        {(from || to) && (
          <Link href={`/inventory/${productId}`} className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-grid-wrap">
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
                    {isIn ? Math.abs(row.signedQty).toLocaleString() : "-"}
                  </td>
                  <td>{!isIn ? (row.partnerName ?? "-") : <span style={{ color: "var(--erp-text-muted)" }}>-</span>}</td>
                  <td className="num" style={{ color: !isIn ? "var(--erp-danger)" : "var(--erp-text-muted)", fontWeight: !isIn ? 700 : undefined }}>
                    {!isIn ? Math.abs(row.signedQty).toLocaleString() : "-"}
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
    </div>
  );
}
