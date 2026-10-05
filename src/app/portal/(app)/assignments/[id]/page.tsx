import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format-number";
import { portalHref } from "@/lib/portal-path";
import { PortalAssignmentStepActions } from "@/components/portal-assignment-step-actions";
import { PageGuide } from "@/components/erp/page-guide";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  material_issued: "생산중",
  completed: "생산완료",
  cancelled: "취소",
};

export default async function PortalAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: workOrderRows }, { data: steps }] = await Promise.all([
    supabase.rpc("subcontractor_get_work_order", { p_work_order_id: id }),
    supabase.rpc("subcontractor_get_work_order_steps", { p_work_order_id: id }),
  ]);

  const workOrder = workOrderRows?.[0];
  if (!workOrder) notFound();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>지시 {workOrder.doc_no}</h1>
        <Link href={await portalHref("/assignments")} className="erp-btn">
          목록
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 16 }}>
        {workOrder.product_name} · {formatNumber(Number(workOrder.quantity))} ·{" "}
        {STATUS_LABEL[workOrder.status] ?? workOrder.status}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">전체 공정 흐름</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            이 생산지시가 거치는 전체 공정입니다. 굵게 표시된 단계가 우리
            업체 담당이며, 그 단계만 직접 상태를 올릴 수 있습니다.
          </PageGuide>
          <div className="flex flex-col gap-2">
            {(steps ?? []).map((s) => (
              <div
                key={s.id}
                className="erp-home-panel"
                style={{
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  border: s.is_mine ? "1px solid var(--erp-primary)" : undefined,
                }}
              >
                <div>
                  <span style={{ fontWeight: s.is_mine ? 700 : 500 }}>{s.process_name}</span>
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: "var(--erp-text-muted)" }}>
                    {s.assignee_kind === "subcontractor" ? (s.subcontractor_name ?? "업체") : "사내"}
                  </span>
                </div>
                {s.is_mine ? (
                  <PortalAssignmentStepActions
                    stepId={s.id}
                    workOrderId={workOrder.id}
                    status={s.status as "pending" | "in_progress" | "done" | "shipped"}
                  />
                ) : (
                  <span className="erp-badge erp-badge-muted">
                    {s.status === "pending"
                      ? "대기"
                      : s.status === "in_progress"
                        ? "시작됨"
                        : s.status === "done"
                          ? "완료"
                          : "배송됨"}
                  </span>
                )}
              </div>
            ))}
            {!steps?.length && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                공정 정보가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
