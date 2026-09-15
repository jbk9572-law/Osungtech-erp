import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { DeleteButton } from "@/components/delete-button";
import { GridBadge } from "@/components/grid/badge";
import { decideApprovalStep, deleteApprovalDocument } from "@/app/(dashboard)/approvals/actions";
import { ApprovalDecisionForm } from "@/components/approval-decision-form";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

export default async function ApprovalDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const [{ data: doc }, { data: steps }] = await Promise.all([
    supabase
      .from("approval_documents")
      .select("id, title, content, status, created_at, decided_at, created_by, profiles!created_by(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("approval_steps")
      .select("id, step_order, approver_id, status, role, comment, decided_at, profiles!approver_id(full_name)")
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
  const myTurn = doc.status === "pending" && currentStep?.approver_id === user?.id;
  const canDelete = doc.created_by === user?.id;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{doc.title}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          {canDelete && (
            <DeleteButton
              action={deleteApprovalDocument}
              id={doc.id}
              confirmMessage="이 기안서를 삭제하시겠습니까? 결재선도 함께 삭제됩니다."
            />
          )}
          <CloseButton href="/approvals">ESC 목록으로</CloseButton>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        {doc.profiles?.full_name ?? "기안자 미상"} · {new Date(doc.created_at).toLocaleString("ko-KR")} ·{" "}
        <GridBadge tone={(STATUS_LABEL[doc.status] ?? { tone: "muted" as const }).tone}>
          {STATUS_LABEL[doc.status]?.label ?? doc.status}
        </GridBadge>
      </p>

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
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-sm border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                >
                  <span style={{ color: "var(--erp-text-muted)" }}>{s.step_order}.</span>
                  <span>{s.profiles?.full_name ?? "구성원"}</span>
                  <GridBadge tone={tone}>
                    {s.status === "approved" ? "승인" : s.status === "rejected" ? "반려" : "대기"}
                  </GridBadge>
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
