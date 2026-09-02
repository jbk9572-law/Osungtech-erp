import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deleteSale } from "@/app/(dashboard)/sales/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { formatPackageQty } from "@/lib/package-qty";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
} from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { PaperStockOverridePanel } from "@/components/paper-stock-override-panel";
import {
  overrideSalesPaperStock,
  revertSalesPaperStock,
} from "@/app/(dashboard)/sales/actions";
import { resolveListHref } from "@/lib/list-return";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { GridBadge } from "@/components/grid/badge";
import { calcVat } from "@/lib/tax";

export default async function SaleDetailPage({
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
  const closeHref = resolveListHref("/sales", back);
  const editHref = `/sales/${id}/edit${back ? `?back=${back}` : ""}`;
  const supabase = await createClient();

  const [
    { data: order },
    { data: items },
    { data: paperCalcs },
    { data: overrideHistory },
    actor,
  ] = await Promise.all([
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
      .order("created_at", { ascending: false }),
    supabase
      .from("paper_stock_overrides")
      .select(
        "id, auto_quantity, override_quantity, note, created_at, reverted_at, profiles!created_by(full_name)",
      )
      .eq("sales_order_id", id)
      .order("created_at", { ascending: false }),
    getCurrentActor(supabase),
  ]);

  if (!order) {
    notFound();
  }

  const allowManage = canManage(order.created_by, actor.userId, actor.isAdmin);

  const rows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = calcVat(supplyAmount);
    return { ...item, supplyAmount, taxAmount };
  });
  const totalSupply = rows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = rows.reduce((sum, row) => sum + row.taxAmount, 0);

  // 이 주문에 모조지 계산이 여러 건 저장돼 있을 수 있다(계산을 나눠서
  // 여러 번 저장했거나, 할일/입고에서 여러 계산을 한 번에 복사해온 경우) —
  // 최신 한 건만 보면 TG0 품목 줄에 찍힌 합계 수량(모든 계산의 합)과 이
  // 아래 규격별 내역이 서로 안 맞게 된다. 목록/인쇄 화면과 동일하게 전부
  // 합쳐서 보여준다.
  const paperCalcSizeLines = formatPaperCalcSizeLines(
    (paperCalcs ?? []).reduce(
      (sizes, calc) => mergePaperCalcInputItems(sizes, calc.input_items),
      [] as ReturnType<typeof mergePaperCalcInputItems>,
    ),
  );

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F9: { href: `/sales/${id}/print`, newTab: true },
          ...(allowManage && { F4: { href: editHref } }),
          Escape: { href: closeHref },
        }}
      />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[var(--erp-text)]">
          매출관리 &gt; 수주 상세
          {order.is_return && <GridBadge tone="danger">반품</GridBadge>}
          {order.is_carryover && <GridBadge tone="warn">이월</GridBadge>}
        </h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link
            href={`/sales/${id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="erp-btn"
          >
            F9 명세표
          </Link>
          {allowManage && (
            <Link href={editHref} className="erp-btn">
              F4 수정
            </Link>
          )}
          {allowManage && (
            <Link href={`/paper-calc?salesOrderId=${id}`} className="erp-btn">
              {paperCalcs && paperCalcs.length > 0
                ? "모조지 계산 이력"
                : "모조지 계산"}
            </Link>
          )}
          {allowManage && (
            <DeleteButton
              action={deleteSale}
              id={id}
              confirmMessage="이 매출 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
            />
          )}
          <Link href={closeHref} className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        {new Date(order.order_date).toLocaleDateString("ko-KR")} 출고
      </p>

      {warning && (
        <p
          className="mb-4 rounded-sm px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--erp-warning-bg)",
            color: "var(--erp-warning)",
          }}
        >
          ⚠ 거래는 정상 등록됐지만: {warning}
        </p>
      )}

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div
          className="erp-detail-body"
          style={{ fontSize: 12.5, paddingTop: 16, paddingBottom: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 26,
              marginBottom: 8,
            }}
          >
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>
              No
            </span>
            <span>{order.doc_no}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 26,
              marginBottom: 8,
            }}
          >
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>
              출고처명
            </span>
            <span>{order.customers?.name ?? "-"}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 26,
              marginBottom: 8,
            }}
          >
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>
              담당자
            </span>
            <span>{order.customers?.contact_name ?? "-"}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 26,
              marginBottom: 8,
            }}
          >
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>
              연락처
            </span>
            <span>{order.customers?.phone ?? "-"}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 26,
              marginBottom: 8,
            }}
          >
            <span style={{ width: 72, color: "var(--erp-text-muted)" }}>
              작성자
            </span>
            <span>{order.profiles?.full_name ?? "-"}</span>
          </div>
          {allowManage && paperCalcs && paperCalcs.length > 0 && (
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
          {order.is_return && order.return_reason && (
            <p style={{ marginTop: 12, color: "var(--erp-danger)" }}>
              반품 사유: {order.return_reason}
            </p>
          )}
          {order.memo && (
            <p style={{ marginTop: 12, color: "var(--erp-text-muted)" }}>
              메모: {order.memo}
            </p>
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
              <th className="num">공급가</th>
              <th className="num">공급가액</th>
              <th className="num">세액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row) => {
              const mainRow = (
                <tr key={row.id}>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.products?.sku}
                  </td>
                  <td>{row.products?.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.spec || row.products?.spec || "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.lot_number || "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.products?.unit}
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {formatPackageQty(
                      row.products?.base_package_qty,
                      row.quantity,
                    )}
                  </td>
                  <td className="num">{row.quantity.toLocaleString()}</td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {formatNumOrDash(row.unit_price)}
                  </td>
                  <td className="num">{row.supplyAmount.toLocaleString()}</td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {row.taxAmount.toLocaleString()}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.remark || "-"}
                  </td>
                </tr>
              );

              if (
                row.products?.sku !== PAPER_STOCK_SKU ||
                paperCalcSizeLines.length === 0
              ) {
                return [mainRow];
              }

              const sizeRows = paperCalcSizeLines.map((line, i) => (
                <tr
                  key={`${row.id}-size-${i}`}
                  style={{ background: "var(--erp-bg-subtle)" }}
                >
                  <td />
                  <td
                    colSpan={3}
                    style={{ color: "var(--erp-text-muted)", paddingLeft: 24 }}
                  >
                    ㄴ {line}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
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
