import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ClickableRow } from "@/components/clickable-row";
import { formatQuantityWithBoxes } from "@/lib/package-qty";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { fetchAllRows } from "@/lib/fetch-all-rows";

const TYPE_TONE: Record<string, BadgeTone> = {
  in: "ok",
  out: "danger",
  adjustment: "muted",
};

const TYPE_LABEL: Record<string, string> = {
  in: "입고",
  out: "출고",
  adjustment: "조정",
};

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

  const [{ data: product }, txRaw] = await Promise.all([
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
  ]);

  if (!product) {
    notFound();
  }

  const allTx = txRaw.reduce<
    {
      id: string;
      date: string;
      type: string;
      signedQty: number;
      partnerName: string | null;
      note: string | null;
      reference: string | null;
      href: string | null;
      balance: number;
      authorName: string | null;
    }[]
  >((acc, t) => {
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
    });
    return acc;
  }, []);

  const rows = allTx
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
        {formatQuantityWithBoxes(currentQuantity, product.base_package_qty)}
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
              <th>구분</th>
              <th>거래처</th>
              <th>비고</th>
              <th>작성자</th>
              <th className="num">수량</th>
              <th className="num">재고 잔량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = (
                <>
                  <td>{new Date(row.date).toLocaleDateString("ko-KR")}</td>
                  <td>
                    <GridBadge tone={TYPE_TONE[row.type] ?? "muted"}>
                      {TYPE_LABEL[row.type] ?? row.type}
                    </GridBadge>
                  </td>
                  <td>{row.partnerName ?? "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.note || "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.authorName ?? "-"}
                  </td>
                  <td
                    className="num"
                    style={{
                      color:
                        row.signedQty < 0 ? "var(--erp-danger)" : undefined,
                    }}
                  >
                    {row.signedQty > 0 ? "+" : ""}
                    {row.signedQty.toLocaleString()}
                  </td>
                  <td className="num">
                    {formatQuantityWithBoxes(
                      row.balance,
                      product.base_package_qty,
                    )}
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
                <td colSpan={7} className="erp-grid-empty">
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
