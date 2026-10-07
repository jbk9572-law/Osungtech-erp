import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { GridBadge } from "@/components/grid/badge";
import { decideApprovalStep, deleteApprovalDocument, recallApprovalDocument } from "@/app/(dashboard)/approvals/actions";
import { ApprovalDecisionForm } from "@/components/approval-decision-form";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

// 결재 상세 화면에서 이 기안이 실제로 어느 화면(원본 레코드)에서 나온
// 건지 바로 갈 수 있게 한다. 연차/근태 정정은 개별 상세 페이지가 없어
// 목록 화면인 hr/attendance로 보낸다.
const SOURCE_LINK: Record<string, { label: string; href: (id: string) => string }> = {
  leave_request: { label: "연차 신청 화면 열기", href: () => "/hr/attendance" },
  attendance_correction: { label: "근태 정정 화면 열기", href: () => "/hr/attendance" },
  purchase_request: { label: "구매요청 원본 열기", href: (id) => `/purchase-requests/${id}` },
  payment_request: { label: "지급결의서 원본 열기", href: (id) => `/reports/payment-requests/${id}` },
  official_document: { label: "공문 원본 열기", href: (id) => `/official-documents/${id}` },
};

// approvals/page.tsx의 목록+상세 분할 화면에서, 목록 옆 패널에 이
// 컴포넌트를 그대로 렌더링한다. 모달/직접 URL 접근
// (approvals/[id]/page.tsx)도 같은 컴포넌트를 쓴다.
export async function ApprovalDetailPanel({ id, closeHref }: { id: string; closeHref: string }) {
  const supabase = await createClient();
  const user = await getUser();

  const [{ data: doc }, { data: steps }] = await Promise.all([
    supabase
      .from("approval_documents")
      .select(
        "id, title, content, status, created_at, decided_at, recalled_at, created_by, source_type, source_id, profiles!created_by(full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("approval_steps")
      .select(
        "id, step_order, approver_id, status, role, comment, decided_at, decided_by, profiles!approver_id(full_name), decider:profiles!decided_by(full_name, signature_image_url)",
      )
      .eq("document_id", id)
      .order("step_order", { ascending: true, nullsFirst: false }),
  ]);

  if (!doc) {
    notFound();
  }

  const allSteps = steps ?? [];
  const approverSteps = allSteps.filter((s) => s.role === "approver");
  const referenceSteps = allSteps.filter((s) => s.role === "reference");
  const currentStep = approverSteps.find((s) => s.status === "pending");

  // 결재선에 있는 결재자 중 누구라도 "지금" 전결권(대리 결재)을 설정해
  // 뒀으면, 아직 결재 전인 단계에서도 "이 사람은 지금 대리인이 처리
  // 중"이라는 걸 결재함 안에서 바로 보여준다 — 예전엔 /settings/
  // delegations에 따로 들어가야만 알 수 있어서, 결재 순서를 기다리는
  // 사람이 "왜 안 넘어오지" 하고 헷갈리는 흐름 단절이 있었다.
  const approverIds = Array.from(new Set(approverSteps.map((s) => s.approver_id)));
  const { data: delegations } =
    user && approverIds.length
      ? await supabase
          .from("approval_delegations")
          .select("delegator_id, delegate_id, start_date, end_date, profiles!delegate_id(full_name)")
          .in("delegator_id", approverIds)
      : { data: [] as { delegator_id: string; delegate_id: string; start_date: string; end_date: string; profiles: { full_name: string | null } | null }[] };
  const today = new Date().toISOString().slice(0, 10);
  const activeDelegationFor = (approverId: string) =>
    (delegations ?? []).find((d) => d.delegator_id === approverId && d.start_date <= today && today <= d.end_date);
  const isActiveDelegateFor = (approverId: string) => activeDelegationFor(approverId)?.delegate_id === user?.id;
  const myTurn = doc.status === "pending" && !!currentStep && (currentStep.approver_id === user?.id || isActiveDelegateFor(currentStep.approver_id));
  const canDelete = doc.created_by === user?.id;
  const canRecall = canDelete && doc.status === "pending" && approverSteps.every((s) => s.status === "pending");

  return (
    <>
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
              // F6(삭제)은 아래 삭제 버튼 하나로만 써야 한다 — DeleteButton을
              // 여기서도 쓰면 두 F6 단축키 핸들러가 동시에 등록돼 F6 한 번에
              // 회수/삭제 확인창이 둘 다 뜨는 문제가 생긴다.
              <InlineConfirmDelete
                action={recallApprovalDocument}
                hiddenFields={{ id: doc.id }}
                warningText="이 기안을 회수하시겠습니까? 결재가 진행 중이었다면 처음부터 다시 상신해야 합니다."
                triggerLabel="회수"
                triggerClassName="erp-btn erp-btn-danger"
              />
            )}
            {canDelete && (
              <DeleteButton
                action={deleteApprovalDocument}
                id={doc.id}
                confirmMessage="이 기안서를 삭제하시겠습니까? 결재선도 함께 삭제됩니다."
              />
            )}
            <Link href={closeHref} className="erp-btn">
              목록
            </Link>
          </>
        }
      />

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기안 내용</span>
        </div>
        <div className="erp-detail-body">
          {doc.source_type && doc.source_id && SOURCE_LINK[doc.source_type] && (
            <Link
              href={SOURCE_LINK[doc.source_type].href(doc.source_id)}
              className="erp-btn"
              style={{ display: "inline-flex", marginBottom: 12 }}
            >
              {SOURCE_LINK[doc.source_type].label} →
            </Link>
          )}
          {/* content는 스마트에디터(리치텍스트)로 작성된 HTML이다. */}
          {doc.content ? (
            <div className="erp-richtext-content" style={{ padding: 0 }} dangerouslySetInnerHTML={{ __html: doc.content }} />
          ) : (
            <p>(내용 없음)</p>
          )}
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
              const pendingDelegation = s.status === "pending" ? activeDelegationFor(s.approver_id) : null;
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
                  {pendingDelegation && (
                    <span className="text-xs" style={{ color: "var(--erp-info-text)" }}>
                      (지금 {pendingDelegation.profiles?.full_name ?? "대리인"}이 대리 결재 중)
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
    </>
  );
}
