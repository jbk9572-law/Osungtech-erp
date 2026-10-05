import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";
import { formatNumber } from "@/lib/format-number";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  material_issued: "생산중",
  completed: "생산완료",
  cancelled: "취소",
};

export default async function PortalAssignmentsPage() {
  const supabase = await createClient();
  const { data: workOrders, error } = await supabase.rpc("subcontractor_list_work_orders");
  if (error) {
    return <p style={{ fontSize: 13, color: "var(--erp-danger)" }}>배정된 공정을 불러오지 못했습니다.</p>;
  }
  const assignmentsBase = await portalHref("/assignments");

  return (
    <div>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>배정된 공정</h1>
      <div className="flex flex-col gap-3">
        {(workOrders ?? []).map((wo) => (
          <Link
            key={wo.id}
            href={`${assignmentsBase}/${wo.id}`}
            className="erp-home-panel"
            style={{ padding: 14, display: "block" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 700 }}>{wo.product_name}</span>
                <span style={{ marginLeft: 8, color: "var(--erp-text-muted)", fontSize: 12 }}>
                  지시 {wo.doc_no} · {formatNumber(Number(wo.quantity))}
                </span>
              </div>
              <span className="erp-badge erp-badge-muted">{STATUS_LABEL[wo.status] ?? wo.status}</span>
            </div>
          </Link>
        ))}
        {!workOrders?.length && (
          <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            아직 배정된 공정이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
