import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deleteSale } from "@/app/(dashboard)/sales/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { formatPackageQty } from "@/lib/package-qty";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { PaperStockOverridePanel } from "@/components/paper-stock-override-panel";
import { overrideSalesPaperStock, revertSalesPaperStock } from "@/app/(dashboard)/sales/actions";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: paperCalcs }, { data: overrideHistory }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("*, customers(*), profiles!created_by(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, spec, unit, base_package_qty)")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase
      .from("paper_calculations")
      .select("id, total_paper, total_sheet, input_items, created_at")
      .eq("sales_order_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("paper_stock_overrides")
      .select("id, auto_quantity, override_quantity, note, created_at, reverted_at, profiles!created_by(full_name)")
      .eq("sales_order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!order) {
    notFound();
  }

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_price),
  }));
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  const paperCalcSizeLines = formatPaperCalcSizeLines(
    mergePaperCalcInputItems([], paperCalcs?.[0]?.input_items)
  );

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F9: { href: `/sales/${id}/print`, newTab: true },
          F4: { href: `/sales/${id}/edit` },
          Escape: { href: "/sales" },
        }}
      />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">매출관리 &gt; 수주 상세</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/sales/${id}/print`} target="_blank" rel="noopener noreferrer" className="erp-btn">
            F9 명세표
          </Link>
          <Link href={`/sales/${id}/edit`} className="erp-btn">
            F4 수정
          </Link>
          <Link href={`/paper-calc?salesOrderId=${id}`} target="_blank" rel="noopener noreferrer" className="erp-btn">
            {paperCalcs && paperCalcs.length > 0 ? "모조지 계산 이력" : "모조지 계산"}
          </Link>
          <DeleteButton
            action={deleteSale}
            id={id}
            confirmMessage="이 매출 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
          />
          <Link href="/sales" className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        {new Date(order.order_date).toLocaleDateString("ko-KR")} 출고
      </p>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div className="erp-detail-body" style={{ fontSize: 12.5, paddingTop: 16, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>거래처명</span>
            <span>{order.customers?.name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>담당자</span>
            <span>{order.customers?.contact_name ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>연락처</span>
            <span>{order.customers?.phone ?? "-"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>작성자</span>
            <span>{order.profiles?.full_name ?? "-"}</span>
          </div>
          {paperCalcs && paperCalcs.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <PaperStockOverridePanel
                orderId={id}
                idFieldName="sales_order_id"
                overrideAction={overrideSalesPaperStock}
                revertAction={revertSalesPaperStock}
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
              <th>단위</th>
              <th className="num">포장수량</th>
              <th className="num">수량</th>
              <th className="num">공급가</th>
              <th className="num">합계금액</th>
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
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.products?.unit}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {formatPackageQty(row.products?.base_package_qty, row.quantity)}
                  </td>
                  <td className="num">{row.quantity.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {Number(row.unit_price).toLocaleString()}
                  </td>
                  <td className="num">{row.amount.toLocaleString()}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.remark || "-"}</td>
                </tr>
              );

              if (row.products?.sku !== PAPER_STOCK_SKU || paperCalcSizeLines.length === 0) {
                return [mainRow];
              }

              const sizeRows = paperCalcSizeLines.map((line, i) => (
                <tr key={`${row.id}-size-${i}`} style={{ background: "#f7f8fb" }}>
                  <td />
                  <td colSpan={2} style={{ color: "var(--erp-text-muted)", paddingLeft: 24 }}>
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
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                </tr>
              ));
              return [mainRow, ...sizeRows];
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
              <td colSpan={7} className="num">
                합계
              </td>
              <td className="num">{totalAmount.toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
