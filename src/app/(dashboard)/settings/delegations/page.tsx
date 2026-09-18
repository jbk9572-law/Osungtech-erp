import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { CloseButton } from "@/components/erp/close-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ApprovalDelegationForm } from "@/components/approval-delegation-form";
import { createApprovalDelegation, deleteApprovalDelegation } from "@/app/(dashboard)/settings/delegations/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function ApprovalDelegationsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  const [profiles, delegations] = await Promise.all([
    fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
    ),
    fetchAllRows<{
      id: string;
      start_date: string;
      end_date: string;
      reason: string | null;
      delegator: { full_name: string | null } | null;
      delegate: { full_name: string | null } | null;
    }>((from, to) =>
      supabase
        .from("approval_delegations")
        .select("id, start_date, end_date, reason, delegator:profiles!delegator_id(full_name), delegate:profiles!delegate_id(full_name)")
        .order("start_date", { ascending: false })
        .range(from, to),
    ),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 전결권 관리" actions={<CloseButton href="/dashboard">✕</CloseButton>} />

      <PageGuide>
        휴가·출장 등으로 자리를 비우는 기간 동안, 지정한 대리 결재자가 그
        사람의 결재를 대신 처리할 수 있습니다. 대리인이 같은 기간에 자신의
        결재권도 위임한 상태이거나, 위임자가 이미 다른 사람의 대리인으로
        지정돼 있으면 순환 위임을 막기 위해 등록이 거부됩니다.
        {isAdmin ? " 관리자는 다른 구성원의 위임도 대신 등록할 수 있습니다." : ""}
      </PageGuide>

      <FormSection tabLabel="새 위임 등록">
        <ApprovalDelegationForm action={createApprovalDelegation} isAdmin={isAdmin} profiles={profiles} />
      </FormSection>

      <div style={{ marginTop: 14 }}>
        {delegations.length === 0 ? (
          <p className="erp-grid-empty">등록된 위임이 없습니다.</p>
        ) : (
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>위임자</th>
                  <th>대리 결재자</th>
                  <th style={{ width: 200 }}>기간</th>
                  <th>사유</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {delegations.map((d) => {
                  const active = d.start_date <= today && today <= d.end_date;
                  return (
                    <tr key={d.id}>
                      <td>{d.delegator?.full_name ?? "-"}</td>
                      <td>
                        {d.delegate?.full_name ?? "-"}
                        {active && (
                          <span
                            className="erp-badge erp-badge-success"
                            style={{ marginLeft: 6 }}
                          >
                            진행중
                          </span>
                        )}
                      </td>
                      <td>
                        {d.start_date} ~ {d.end_date}
                      </td>
                      <td>{d.reason || "-"}</td>
                      <td>
                        <InlineConfirmDelete
                          action={deleteApprovalDelegation}
                          hiddenFields={{ id: d.id }}
                          warningText="이 위임을 삭제하시겠습니까?"
                          triggerStyle={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
