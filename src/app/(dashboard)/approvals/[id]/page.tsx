import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { GridBadge } from "@/components/grid/badge";
import { decideApprovalStep, deleteApprovalDocument, recallApprovalDocument } from "@/app/(dashboard)/approvals/actions";
import { ApprovalDecisionForm } from "@/components/approval-decision-form";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

export default async function ApprovalDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const [{ data: doc }, { data: steps }, { data: delegations }] = await Promise.all([
    supabase
      .from("approval_documents")
      .select("id, title, content, status, created_at, decided_at, recalled_at, created_by, profiles!created_by(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("approval_steps")
      .select(
        "id, step_order, approver_id, status, role, comment, decided_at, decided_by, profiles!approver_id(full_name), decider:profiles!decided_by(full_name, signature_image_url)",
      )
      .eq("document_id", id)
      .order("step_order", { ascending: true, nullsFirst: false }),
    user
      ? supabase.from("approval_delegations").select("delegator_id, start_date, end_date").eq("delegate_id", user.id)
      : Promise.resolve({ data: [] as { delegator_id: string; start_date: string; end_date: string }[] }),
  ]);

  if (!doc) {
    notFound();
  }

  const allSteps = steps ?? [];
  const approverSteps = allSteps.filter((s) => s.role === "approver");
  const referenceSteps = allSteps.filter((s) => s.role === "reference");
  const currentStep = approverSteps.find((s) => s.status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const isActiveDelegateFor = (approverId: string) =>
    (delegations ?? []).some((d) => d.delegator_id === approverId && d.start_date <= today && today <= d.end_date);
  const myTurn = doc.status === "pending" && !!currentStep && (currentStep.approver_id === user?.id || isActiveDelegateFor(currentStep.approver_id));
  const canDelete = doc.created_by === user?.id;
  const canRecall = canDelete && doc.status === "pending" && approverSteps.every((s) => s.status === "pending");

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <DetailPageHeader
        title={doc.title}
        meta={
          <>
            {doc.profiles?.full_name ?? "기안자 미상"} · {new Date(doc.created_at).toLocaleString("ko-KR")} ·{" "}
            <GridBadge tone={(STATUS_LABEL[doc.status] ?? { tone: "muted" as const }).tone}>
              {STATUS_LABEL[doc.status]?.label ?? doc.status}
            </GridBadge>
          </>
        }
        actions={
          <>
            {canRecall && (
              <DeleteButton
                action={recallApprovalDocument}
                id={doc.id}
                label="회수"
                confirmMessage="이 기안을 회수하시겠습니까? 결재가 진행 중이었다면 처음부터 다시 상신해야 합니다."
              />
            )}
            {canDelete && (
              <DeleteButton
                action={deleteApprovalDocument}
                id={doc.id}
                confirmMessage="이 기안서를 삭제하시겠습니까? 결재선도 함께 삭제됩니다."
              />
            )}
            <CloseButton href="/approvals">ESC 목록으로</CloseButton>
          </>
        }
      />

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기안 내용</span>
        </div>
        <div className="erp-detail-body">
          <p style={{ whiteSpace: "pre-wrap" }}>{doc.content || "(내용 없음)"}</p>
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">결재선</span>
        </div>
        <div className="erp-detail-body">
          <div className="m-steps flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
            {approverSteps.map((s) => {
              const tone = s.status === "approved" ? "ok" : s.status === "rejected" ? "danger" : "muted";
              const decidedByDelegate = s.decided_by && s.decided_by !== s.approver_id;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-sm border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                >
                  <span style={{ color: "var(--erp-text-muted)" }}>{s.step_order}.</span>
                  <span>{s.profiles?.full_name ?? "구성원"}</span>
                  {s.status === "approved" && s.decider?.signature_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 사용자가 직접 올린 임의 크기 서명 이미지라 next/image 최적화 대상이 아니다
                    <img
                      src={s.decider.signature_image_url}
                      alt={`${s.decider.full_name ?? "결재자"} 서명`}
                      style={{ height: 22, width: "auto" }}
                    />
                  ) : (
                    <GridBadge tone={tone}>{s.status === "approved" ? "승인" : s.status === "rejected" ? "반려" : "대기"}</GridBadge>
                  )}
                  {decidedByDelegate && (
                    <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                      (대결: {s.decider?.full_name ?? "대리인"})
                    </span>
                  )}
                  {s.comment && (
                    <span style={{ color: "var(--erp-text-muted)", fontSize: 12 }}>&quot;{s.comment}&quot;</span>
                  )}
                </div>
              );
            })}
          </div>

          {referenceSteps.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: myTurn ? 16 : 0 }}>
              <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                참조:
              </span>
              {referenceSteps.map((s) => (
                <GridBadge key={s.id} tone="info">
                  {s.profiles?.full_name ?? "구성원"}
                </GridBadge>
              ))}
            </div>
          )}

          {myTurn && currentStep && (
            <ApprovalDecisionForm action={decideApprovalStep} stepId={currentStep.id} documentId={doc.id} />
          )}
        </div>
      </div>
    </div>
  );
}
