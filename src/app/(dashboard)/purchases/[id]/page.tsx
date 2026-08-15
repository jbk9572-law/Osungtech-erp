import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deletePurchase } from "@/app/(dashboard)/purchases/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { formatPackageQty } from "@/lib/package-qty";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { PaperStockOverridePanel } from "@/components/paper-stock-override-panel";
import { overridePurchasePaperStock, revertPurchasePaperStock } from "@/app/(dashboard)/purchases/actions";
import { resolveListHref } from "@/lib/list-return";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";

export default async function PurchaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; warning?: string }>;
}) {
  const { id } = await params;
  const { back, warning } = await searchParams;
  // 목록에서 검색/필터를 걸어둔 채로 이 화면에 들어왔으면, ESC/닫기로
  // 나갈 때 그 조건 그대로(전체 목록이 아니라) 되돌아가게 한다.
  const closeHref = resolveListHref("/purchases", back);
  const editHref = `/purchases/${id}/edit${back ? `?back=${back}` : ""}`;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: paperCalcs }, { data: overrideHistory }, actor] =
    await Promise.all([
      supabase
        .from("purchase_orders")
        .select("*, suppliers(*), profiles!created_by(full_name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("*, products(sku, name, spec, unit, base_package_qty)")
        .eq("purchase_order_id", id)
        .order("created_at"),
      supabase
        .from("paper_calculations")
        .select("id, total_paper, total_sheet, input_items, created_at")
        .eq("purchase_order_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("paper_stock_overrides")
        .select("id, auto_quantity, override_quantity, note, created_at, reverted_at, profiles!created_by(full_name)")
        .eq("purchase_order_id", id)
        .order("created_at", { ascending: false }),
      getCurrentActor(supabase),
    ]);

  if (!order) {
    notFound();
  }

  const allowManage = canManage(order.created_by, actor.userId, actor.isAdmin);

  const rows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_cost);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });
  const totalSupply = rows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = rows.reduce((sum, row) => sum + row.taxAmount, 0);

  const paperCalcSizeLines = formatPaperCalcSizeLines(
    mergePaperCalcInputItems([], paperCalcs?.[0]?.input_items)
  );

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          ...(allowManage && { F4: { href: editHref } }),
          Escape: { href: closeHref },
        }}
      />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">매입관리 &gt; 발주 상세</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          {allowManage && (
            <Link href={editHref} className="erp-btn">
              F4 수정
            </Link>
          )}
          <Link href={`/paper-calc?purchaseOrderId=${id}`} className="erp-btn">
            {paperCalcs && paperCalcs.length > 0 ? "모조지 계산 이력" : "모조지 계산"}
          </Link>
          {allowManage && (
            <DeleteButton
              action={deletePurchase}
              id={id}
              confirmMessage="이 매입 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
            />
          )}
          <Link href={closeHref} className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        {new Date(order.purchase_date).toLocaleDateString("ko-KR")} 입고
      </p>

      {warning && (
        <p
          className="mb-4 rounded-sm px-3 py-2 text-xs font-medium"
          style={{ background: "var(--erp-warning-bg)", color: "var(--erp-warning)" }}
        >
          ⚠ 거래는 정상 등록됐지만: {warning}
        </p>
      )}

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div className="erp-detail-body" style={{ fontSize: 12.5, paddingTop: 16, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>No</span>
            <span>{order.doc_no}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>업체명</span>
            <span>{order.suppliers?.name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>담당자</span>
            <span>{order.suppliers?.contact_name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>연락처</span>
            <span>{order.suppliers?.phone ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>작성자</span>
            <span>{order.profiles?.full_name ?? "-"}</span>
          </div>
          {paperCalcs && paperCalcs.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <PaperStockOverridePanel
                orderId={id}
                idFieldName="purchase_order_id"
                overrideAction={overridePurchasePaperStock}
                revertAction={revertPurchasePaperStock}
                history={overrideHistory ?? []}
              />
            </div>
          )}
          {order.memo && (
            <p style={{ marginTop: 12, color: "var(--erp-text-muted)" }}>메모: {order.memo}</p>
          )}
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>품목명</th>
              <th>규격</th>
              <th>관리번호</th>
              <th>단위</th>
              <th className="num">포장수량</th>
              <th className="num">수량</th>
              <th className="num">매입가</th>
              <th className="num">공급가액</th>
              <th className="num">세액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row) => {
              const mainRow = (
                <tr key={row.id}>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.products?.sku}</td>
                  <td>{row.products?.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.spec || row.products?.spec || "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.lot_number || "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.products?.unit}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {formatPackageQty(row.products?.base_package_qty, row.quantity)}
                  </td>
                  <td className="num">{row.quantity.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {Number(row.unit_cost).toLocaleString()}
                  </td>
                  <td className="num">{row.supplyAmount.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {row.taxAmount.toLocaleString()}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.remark || "-"}</td>
                </tr>
              );

              if (row.products?.sku !== PAPER_STOCK_SKU || paperCalcSizeLines.length === 0) {
                return [mainRow];
              }

              const sizeRows = paperCalcSizeLines.map((line, i) => (
                <tr key={`${row.id}-size-${i}`} style={{ background: "var(--erp-bg-subtle)" }}>
                  <td />
                  <td colSpan={3} style={{ color: "var(--erp-text-muted)", paddingLeft: 24 }}>
                    ㄴ {line}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                </tr>
              ));
              return [mainRow, ...sizeRows];
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
              <td colSpan={8} className="num">
                합계
              </td>
              <td className="num">{totalSupply.toLocaleString()}</td>
              <td className="num">{totalTax.toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
