import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { WorkOrderStatusActions } from "@/components/work-order-status-actions";
import { WorkOrderProcessStepActions } from "@/components/work-order-process-step-actions";
import { WorkOrderProcessStepAssignCell } from "@/components/work-order-process-step-assign-cell";

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "production");

  const [{ data: workOrder }, { data: steps }, { data: subcontractors }] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, doc_no, order_date, quantity, status, memo, products(sku, name, spec, unit), warehouses(name), profiles!created_by(full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("work_order_process_steps")
      .select("id, process_name, sort_order, status, assignee_kind, subcontractor_id, subcontractors(name)")
      .eq("work_order_id", id)
      .order("sort_order"),
    supabase.from("subcontractors").select("id, name").order("name"),
  ]);

  if (!workOrder) notFound();

  // 배정된 업체가 이미 포털 계정이 있는지 — 없으면 이 화면에서 바로
  // 발급 버튼을 보여준다(하청업체관리로 따로 넘어가지 않아도 되게).
  const assignedSubcontractorIds = Array.from(
    new Set((steps ?? []).map((s) => s.subcontractor_id).filter((sid): sid is string => sid !== null)),
  );
  const { data: accountRows } = assignedSubcontractorIds.length
    ? await supabase
        .from("customer_portal_accounts")
        .select("subcontractor_id")
        .eq("kind", "subcontractor")
        .eq("disabled", false)
        .in("subcontractor_id", assignedSubcontractorIds)
    : { data: [] as { subcontractor_id: string | null }[] };
  const subcontractorsWithAccount = new Set((accountRows ?? []).map((a) => a.subcontractor_id));

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F9: { href: `/production/${workOrder.id}/print` }, Escape: { href: "/production" } }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          생산관리 &gt; 생산지시 내역 &gt; {workOrder.doc_no}
        </h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/production/${workOrder.id}/print`} className="erp-btn">
            F9 출력
          </Link>
          <Link href="/production" className="erp-btn">
            목록
          </Link>
        </div>
      </div>

      <PageGuide>
        이 생산지시가 거치는 공정별 진행 상태입니다. 각 단계는 사내에서
        직접 처리하거나(기본값) 특정 하청업체로 배정할 수 있고, 배정된
        업체는 포털에 로그인해 직접 시작/완료/배송 처리를 올릴 수
        있습니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">지시 정보</span>
        </div>
        <div className="erp-detail-body">
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <tbody>
                <tr>
                  <th style={{ width: 110 }}>완제품</th>
                  <td>
                    {workOrder.products?.sku} · {workOrder.products?.name}
                    {workOrder.products?.spec && ` (${workOrder.products.spec})`}
                  </td>
                  <th style={{ width: 90 }}>수량</th>
                  <td className="num">
                    {formatNumber(Number(workOrder.quantity))} {workOrder.products?.unit}
                  </td>
                </tr>
                <tr>
                  <th>LOT번호 / 제조일</th>
                  <td>
                    LOT {workOrder.doc_no} · {workOrder.order_date.replaceAll("-", ".")}
                  </td>
                  <th>창고</th>
                  <td>{workOrder.warehouses?.name ?? "-"}</td>
                </tr>
                <tr>
                  <th>등록자</th>
                  <td>{workOrder.profiles?.full_name ?? "-"}</td>
                  <th>상태</th>
                  <td>
                    <WorkOrderStatusActions id={workOrder.id} status={workOrder.status} />
                  </td>
                </tr>
                {workOrder.memo && (
                  <tr>
                    <th>메모</th>
                    <td colSpan={3}>{workOrder.memo}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">공정 체크리스트</span>
        </div>
        <div className="erp-detail-body">
          {steps && steps.length > 0 ? (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>순서</th>
                    <th>공정</th>
                    <th style={{ width: 110 }}>이전 담당</th>
                    <th style={{ width: 160 }}>담당</th>
                    <th style={{ width: 160 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s, idx) => {
                    const prev = idx > 0 ? steps[idx - 1] : null;
                    const prevLabel = prev
                      ? prev.assignee_kind === "subcontractor"
                        ? (prev.subcontractors?.name ?? "업체")
                        : "사내"
                      : null;
                    return (
                    <tr key={s.id}>
                      <td className="num">{s.sort_order}</td>
                      <td>{s.process_name}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{prevLabel ?? "-"}</td>
                      <td>
                        <WorkOrderProcessStepAssignCell
                          id={s.id}
                          workOrderId={workOrder.id}
                          subcontractorId={s.subcontractor_id}
                          hasPortalAccount={s.subcontractor_id ? subcontractorsWithAccount.has(s.subcontractor_id) : true}
                          subcontractors={subcontractors ?? []}
                        />
                      </td>
                      <td>
                        <WorkOrderProcessStepActions id={s.id} workOrderId={workOrder.id} status={s.status} />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              이 완제품에 등록된 공정 라우팅이 없어 체크리스트가 없습니다.
              (품목관리에서 공정 라우팅을 등록하면 다음 생산지시부터
              적용됩니다.)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
