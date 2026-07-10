import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDatePresets } from "@/lib/date-presets";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ClickableRow } from "@/components/clickable-row";

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

  const [{ data: product }, { data: txRaw }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, spec, unit, reorder_point, inventory(quantity)")
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("inventory_transactions")
      .select(
        "id, type, quantity, note, created_at, sales_order_id, purchase_order_id, sales_orders(order_date, customers(name)), purchase_orders(purchase_date, suppliers(name))"
      )
      .eq("product_id", productId)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  if (!product) {
    notFound();
  }

  const allTx = (txRaw ?? []).reduce<
    { id: string; date: string; type: string; signedQty: number; partnerName: string | null; note: string | null; href: string | null; balance: number }[]
  >((acc, t) => {
    const date = t.sales_orders?.order_date ?? t.purchase_orders?.purchase_date ?? t.created_at.slice(0, 10);
    const signedQty = t.type === "out" ? -Math.abs(t.quantity) : t.quantity;
    const balance = (acc.at(-1)?.balance ?? 0) + signedQty;
    acc.push({
      id: t.id,
      date,
      type: t.type,
      signedQty,
      partnerName: t.sales_orders?.customers?.name ?? t.purchase_orders?.suppliers?.name ?? null,
      note: t.note,
      href: t.sales_order_id
        ? `/sales/${t.sales_order_id}`
        : t.purchase_order_id
          ? `/purchases/${t.purchase_order_id}`
          : null,
      balance,
    });
    return acc;
  }, []);

  const rows = allTx.filter((t) => (!from || t.date >= from) && (!to || t.date <= to)).reverse();
  const presets = getDatePresets();
  const currentQuantity = product.inventory?.[0]?.quantity ?? 0;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <h1 className="mb-1 text-lg font-bold text-[#1c1c1c]">재고관리 &gt; 재고현황 &gt; 입출고내역</h1>
      <p className="mb-4 text-xs text-[#6b7280]">
        {product.sku} · {product.name}
        {product.spec && ` (${product.spec})`} · 현재 재고 {currentQuantity.toLocaleString()}
        {product.unit ?? ""}
      </p>

      <div className="erp-toolbar">
        <Link href="/inventory" className="erp-btn">
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
          <input type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label>종료일</label>
          <input type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
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
                    <span
                      className={`erp-badge ${row.type === "out" ? "erp-badge-danger" : row.type === "in" ? "erp-badge-success" : ""}`}
                    >
                      {TYPE_LABEL[row.type] ?? row.type}
                    </span>
                  </td>
                  <td>{row.partnerName ?? "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.note || "-"}</td>
                  <td className="num" style={{ color: row.signedQty < 0 ? "var(--erp-danger)" : undefined }}>
                    {row.signedQty > 0 ? "+" : ""}
                    {row.signedQty.toLocaleString()}
                  </td>
                  <td className="num">{row.balance.toLocaleString()}</td>
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
                <td colSpan={6} className="erp-grid-empty">
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
