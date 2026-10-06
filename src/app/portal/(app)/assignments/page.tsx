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
import {
  PortalAssignmentsGridTable,
  type PortalAssignmentRow,
  type PortalAssignmentStep,
} from "@/components/portal-assignments-grid-table";

export default async function PortalAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  // 주문내역(portal/orders)과 같은 이유로 기본값은 "이번달" — 업체당
  // 배정 건수가 적어 "오늘"로 좁히면 평소엔 화면이 거의 비어 보인다.
  const thisMonth = getMonthRange(currentMonth());
  const effectiveFrom = from || thisMonth.from;
  const effectiveTo = to || thisMonth.to;

  const supabase = await createClient();
  const [{ data: workOrders, error }, { data: stepRows }] = await Promise.all([
    supabase.rpc("subcontractor_list_work_orders"),
    supabase.rpc("subcontractor_list_all_work_order_steps"),
  ]);
  if (error) {
    return <p style={{ fontSize: 13, color: "var(--erp-danger)" }}>배정된 공정을 불러오지 못했습니다.</p>;
  }

  const stepsByWorkOrderId = new Map<string, PortalAssignmentStep[]>();
  for (const s of stepRows ?? []) {
    const list = stepsByWorkOrderId.get(s.work_order_id) ?? [];
    list.push({ processName: s.process_name, sortOrder: s.sort_order, status: s.status, isMine: s.is_mine });
    stepsByWorkOrderId.set(s.work_order_id, list);
  }

  const rows: PortalAssignmentRow[] = (workOrders ?? [])
    .filter((wo) => wo.order_date >= effectiveFrom && wo.order_date <= effectiveTo)
    .map((wo) => ({
      id: wo.id,
      docNo: wo.doc_no,
      productName: wo.product_name,
      productSpec: wo.product_spec,
      quantity: Number(wo.quantity),
      status: wo.status,
      orderDate: wo.order_date,
      steps: (stepsByWorkOrderId.get(wo.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));

  const assignmentsHref = await portalHref("/assignments");
  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F5: { submitFormSelector: "#portal-assignments-search-form" },
        }}
      />
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>배정된 공정</h1>

      <DateRangeQuickFilters
        basePath={assignmentsHref}
        presets={presets}
        monthButtons={monthButtons}
        from={effectiveFrom}
        to={effectiveTo}
      />

      <form method="get" id="portal-assignments-search-form" className="erp-search">
        <div className="erp-field">
          <label htmlFor="portal-assignments-from">시작일</label>
          <input id="portal-assignments-from" type="date" name="from" defaultValue={effectiveFrom} className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="portal-assignments-to">종료일</label>
          <input id="portal-assignments-to" type="date" name="to" defaultValue={effectiveTo} className="erp-input" />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to) && (
          <Link href={assignmentsHref} className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <PortalAssignmentsGridTable rows={rows} assignmentsHref={assignmentsHref} />
    </div>
  );
}
