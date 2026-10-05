import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { PortalAccountForm, PortalAccountDisableForm } from "@/components/portal-account-form";
import { PageGuide } from "@/components/erp/page-guide";
import { updateSubcontractor } from "@/app/(dashboard)/subcontractors/actions";

export async function SubcontractorDetailPanel({ id }: { id: string }) {
  const supabase = await createClient();

  const [{ data: subcontractor }, { data: portalAccounts }, { data: assignedSteps }] = await Promise.all([
    supabase.from("subcontractors").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("customer_portal_accounts")
      .select("id, username, disabled, created_at")
      .eq("subcontractor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("work_order_process_steps")
      .select("id, process_name, status, work_orders(id, doc_no, products(name))")
      .eq("subcontractor_id", id)
      .order("sort_order"),
  ]);

  if (!subcontractor) {
    return <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>업체를 찾을 수 없습니다.</p>;
  }

  return (
    <>
      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업체 정보</span>
        </div>
        <div className="erp-detail-body">
          <SubcontractorForm action={updateSubcontractor} idFieldValue={subcontractor.id} initial={subcontractor} />
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업체 포털 계정</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            이 업체가 직접 로그인해 배정된 공정의 진행 상태(시작/완료/배송)를
            올릴 수 있는 포털 계정입니다. 거래처 포털과 같은 방식(아이디+
            비밀번호)으로 로그인하며, 내부 직원 계정과는 완전히 분리됩니다.
          </PageGuide>
          <PortalAccountForm targetId={subcontractor.id} kind="subcontractor" />
          {portalAccounts && portalAccounts.length > 0 && (
            <div className="erp-grid-wrap" style={{ marginTop: 12 }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th style={{ width: 90 }}>상태</th>
                    <th style={{ width: 110 }}>발급일</th>
                    <th style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {portalAccounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.username}</td>
                      <td>
                        <span className={`erp-badge ${a.disabled ? "erp-badge-muted" : "erp-badge-success"}`}>
                          {a.disabled ? "비활성" : "사용중"}
                        </span>
                      </td>
                      <td>{new Date(a.created_at).toLocaleDateString("ko-KR")}</td>
                      <td>{!a.disabled && <PortalAccountDisableForm id={a.id} kind="subcontractor" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">배정된 공정</span>
        </div>
        <div className="erp-detail-body">
          {assignedSteps && assignedSteps.length > 0 ? (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>지시번호</th>
                    <th>완제품</th>
                    <th>공정</th>
                    <th style={{ width: 90 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedSteps.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.work_orders?.id ? (
                          <Link href={`/production/${s.work_orders.id}`}>{s.work_orders.doc_no}</Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{s.work_orders?.products?.name ?? "-"}</td>
                      <td>{s.process_name}</td>
                      <td>
                        <span className="erp-badge erp-badge-muted">
                          {s.status === "pending" ? "대기" : s.status === "in_progress" ? "시작" : s.status === "done" ? "완료" : "배송"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <PageGuide>
              아직 이 업체에 배정된 공정이 없습니다. 생산지시 상세에서 공정
              단계를 이 업체로 배정할 수 있습니다.
            </PageGuide>
          )}
        </div>
      </div>
    </>
  );
}
