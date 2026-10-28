import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deleteSale } from "@/app/(dashboard)/sales/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PaperCalcNavLink } from "@/components/erp/paper-calc-nav-link";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
} from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU, isPaperCalcEnabled } from "@/lib/paper-calc-sync";
import { PaperStockOverridePanel } from "@/components/paper-stock-override-panel";
import {
  overrideSalesPaperStock,
  revertSalesPaperStock,
} from "@/app/(dashboard)/sales/actions";
import { resolveListHref } from "@/lib/list-return";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { GridBadge } from "@/components/grid/badge";
import { calcVat } from "@/lib/tax";
import { canIssueTaxInvoice, isTaxExempt } from "@/lib/tax-evidence-type";
import { PageGuide } from "@/components/erp/page-guide";
import { DetailPageHeader, DetailInfoRow } from "@/components/erp/page-header";
import { OrderItemsTable, type OrderItemRow } from "@/components/grid/order-items-table";

export default async function SaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; warning?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back, warning } = await searchParams;
  // 목록에서 검색/필터를 걸어둔 채로 이 화면에 들어왔으면, ESC/닫기로
  // 나갈 때 그 조건 그대로(전체 목록이 아니라) 되돌아가게 한다.
  const closeHref = resolveListHref("/sales", back);
  const editHref = `/sales/${id}/edit${back ? `?back=${back}` : ""}`;
  const printHref = `/sales/${id}/print${back ? `?back=${back}` : ""}`;
  const taxInvoiceHref = `/sales/${id}/tax-invoice${back ? `?back=${back}` : ""}`;
  const supabase = await createClient();

  const [
    { data: order },
    { data: items },
    { data: paperCalcs },
    { data: overrideHistory },
    actor,
    paperCalcEnabled,
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
    isPaperCalcEnabled(supabase),
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
  const itemRows: OrderItemRow[] = rows.map((row) => ({
    id: row.id,
    sku: row.products?.sku,
    productLabel: row.products?.name ?? row.custom_name ?? "-",
    spec: row.spec || row.products?.spec || null,
    lotNumber: row.lot_number,
    unit: row.products?.unit,
    basePackageQty: row.products?.base_package_qty,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    supplyAmount: row.supplyAmount,
    taxAmount: row.taxAmount,
    remark: row.remark,
    showPaperCalcSizeLines: row.products?.sku === PAPER_STOCK_SKU,
  }));

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
          F9: { href: printHref },
          ...(allowManage && { F4: { href: editHref } }),
          Escape: { href: closeHref },
        }}
      />
      <DetailPageHeader
        title={
          <>
            매출관리 &gt; 수주 상세
            {order.is_return && <GridBadge tone="danger">반품</GridBadge>}
            {order.is_sample && <GridBadge tone="info">샘플</GridBadge>}
            {order.is_carryover && <GridBadge tone="warn">이월</GridBadge>}
          </>
        }
        meta={`${new Date(order.order_date).toLocaleDateString("ko-KR")} 출고`}
        actions={
          <>
            <Link href={printHref} className="erp-btn">
              F9 명세표
            </Link>
            {allowManage && (
              <Link href={editHref} className="erp-btn">
                F4 수정
              </Link>
            )}
            {allowManage && paperCalcEnabled && (
              <PaperCalcNavLink href={`/paper-calc?salesOrderId=${id}`} className="erp-btn">
                {paperCalcs && paperCalcs.length > 0
                  ? "모조지 계산 이력"
                  : "모조지 계산"}
              </PaperCalcNavLink>
            )}
            {allowManage && (
              <DeleteButton
                action={deleteSale}
                id={id}
                confirmMessage="이 매출 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
              />
            )}
          </>
        }
      />

      {warning && (
        <PageGuide tone="warning" className="font-medium">
          ⚠ 거래는 정상 등록됐지만: {warning}
        </PageGuide>
      )}

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div
          className="erp-detail-body"
          style={{ fontSize: 12.5, paddingTop: 16, paddingBottom: 16 }}
        >
          <DetailInfoRow label="No">{order.doc_no}</DetailInfoRow>
          <DetailInfoRow label="출고처명">{order.customers?.name ?? "-"}</DetailInfoRow>
          <DetailInfoRow label="담당자">{order.customers?.contact_name ?? "-"}</DetailInfoRow>
          <DetailInfoRow label="연락처">{order.customers?.phone ?? "-"}</DetailInfoRow>
          <DetailInfoRow label="작성자">{order.profiles?.full_name ?? "-"}</DetailInfoRow>
          {allowManage && paperCalcEnabled && paperCalcs && paperCalcs.length > 0 && (
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
          {allowManage && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {order.invoice_status === "issued" ? (
                <>
                  <GridBadge tone="ok">계산서 발행완료</GridBadge>
                  <span style={{ color: "var(--erp-text-muted)" }}>
                    {order.invoice_issued_at ? new Date(order.invoice_issued_at).toLocaleDateString("ko-KR") : "-"}
                  </span>
                  <Link href={taxInvoiceHref} className="erp-btn" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
                    세금계산서 보기
                  </Link>
                </>
              ) : isTaxExempt(order.tax_type) ? (
                <GridBadge tone="muted">면세 — 계산서 발행 대상(아직 미구현)</GridBadge>
              ) : !canIssueTaxInvoice(order.evidence_type) ? (
                <GridBadge tone="muted">증빙유형: {order.evidence_type} (세금계산서 불필요)</GridBadge>
              ) : (
                <>
                  <GridBadge tone="muted">계산서 미발행</GridBadge>
                  <Link href={taxInvoiceHref} className="erp-btn erp-btn-primary" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
                    세금계산서 작성
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <OrderItemsTable
        rows={itemRows}
        priceLabel="공급가"
        paperCalcSizeLines={paperCalcSizeLines}
        totalSupply={totalSupply}
        totalTax={totalTax}
      />
    </div>
  );
}
