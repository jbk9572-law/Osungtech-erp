import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";
import {
  getQuickDatePresets,
  getYearMonthButtons,
  currentMonth,
  getMonthRange,
} from "@/lib/date-presets";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PortalOrdersGridTable, type PortalOrderRow } from "@/components/portal-orders-grid-table";
import type { OrderDetailItem } from "@/components/grid/order-detail-panel";

// work_order_status(생산지시 상태)와 shipping_status(배송 상태)를 조합해
// 거래처가 실제로 궁금한 "지금 어디까지 왔는지" 한 줄로 만든다 — 내부
// 화면처럼 상태 컬럼을 여러 개 늘어놓지 않고, 포털은 이 한 줄만 보여준다.
function describeProgress(row: {
  status: string;
  work_order_status: string | null;
  shipping_status: string;
}): string {
  if (row.status === "requested") return "검토 대기";
  if (row.status === "rejected") return "반려";
  if (row.status === "cancelled") return "취소";
  if (row.shipping_status === "delivered") return "배송완료";
  if (row.shipping_status === "shipped") return "배송중";
  if (row.work_order_status === "completed") return "생산완료(출고대기)";
  if (row.work_order_status === "material_issued") return "생산중";
  if (row.work_order_status === "pending") return "생산대기";
  return "승인됨(처리 대기)";
}

export default async function PortalOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  // 매출관리는 거래량이 많아 기본값이 "오늘"이지만, 포털 주문은 거래처
  // 한 곳당 건수가 적어 "오늘"로 좁히면 평소엔 화면이 거의 비어 보인다
  // — 기본값만 "이번달"로 넓게 잡고, 조회기간 프리셋/F5 검색은 매출관리와
  // 똑같은 컴포넌트를 그대로 쓴다.
  const thisMonth = getMonthRange(currentMonth());
  const effectiveFrom = from || thisMonth.from;
  const effectiveTo = to || thisMonth.to;

  const supabase = await createClient();
  const [{ data: orders, error }, { data: itemRows }] = await Promise.all([
    supabase.rpc("portal_list_orders"),
    supabase.rpc("portal_list_order_items"),
  ]);
  if (error) {
    return <p style={{ fontSize: 13, color: "var(--erp-danger)" }}>주문 내역을 불러오지 못했습니다.</p>;
  }

  const itemsByOrderId = new Map<string, OrderDetailItem[]>();
  for (const item of itemRows ?? []) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({
      productLabel: item.name,
      spec: item.spec || "-",
      lotNumber: null,
      remark: null,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unit_price,
      supplyAmount: item.quantity * item.unit_price,
      taxAmount: 0,
    });
    itemsByOrderId.set(item.order_id, list);
  }

  const rows: PortalOrderRow[] = (orders ?? [])
    .filter((o) => {
      const dateKey = o.created_at.slice(0, 10);
      return dateKey >= effectiveFrom && dateKey <= effectiveTo;
    })
    .map((o) => ({
      id: o.id,
      docNo: o.doc_no,
      createdAt: o.created_at,
      itemCount: o.item_count,
      totalAmount: o.total_amount,
      progressLabel: describeProgress(o),
      isRejected: o.status === "rejected",
      memo: o.memo,
      items: itemsByOrderId.get(o.id) ?? [],
    }));

  const newHref = await portalHref("/new");
  const ordersHref = await portalHref("/orders");
  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          F5: { submitFormSelector: "#portal-orders-search-form" },
        }}
      />
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>주문내역</h1>

      <DateRangeQuickFilters
        basePath={ordersHref}
        presets={presets}
        monthButtons={monthButtons}
        from={effectiveFrom}
        to={effectiveTo}
      />

      <form method="get" id="portal-orders-search-form" className="erp-search">
        <div className="erp-field">
          <label htmlFor="portal-orders-from">시작일</label>
          <input id="portal-orders-from" type="date" name="from" defaultValue={effectiveFrom} className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="portal-orders-to">종료일</label>
          <input id="portal-orders-to" type="date" name="to" defaultValue={effectiveTo} className="erp-input" />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to) && (
          <Link href={ordersHref} className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar">
        <Link href={newHref} className="erp-btn erp-btn-primary">
          F2 새 발주
        </Link>
      </div>

      <PortalOrdersGridTable rows={rows} ordersHref={ordersHref} />
    </div>
  );
}
