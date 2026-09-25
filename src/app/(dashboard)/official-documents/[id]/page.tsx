import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { GridBadge } from "@/components/grid/badge";
import { DeleteButton } from "@/components/delete-button";
import { OfficialDocumentSubmitForm } from "@/components/official-document-submit-form";
import { OfficialDocumentStatusButton } from "@/components/official-document-status-button";
import { SendOfficialDocumentButton } from "@/components/send-official-document-button";
import { RecipientManualDeliverButton } from "@/components/recipient-manual-deliver-button";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";
import {
  deleteOfficialDocument,
  submitOfficialDocumentForApproval,
  closeOfficialDocument,
  cancelOfficialDocument,
  markRecipientDeliveredManually,
} from "@/app/(dashboard)/official-documents/actions";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending_approval: { label: "결재중", tone: "warn" },
  approved: { label: "승인(발송대기)", tone: "info" },
  sent: { label: "발송완료", tone: "ok" },
  closed: { label: "종결", tone: "muted" },
  cancelled: { label: "취소", tone: "danger" },
};
const DISCLOSURE_LABEL: Record<string, string> = { public: "공개", partial: "부분공개", private: "비공개" };
const RETENTION_LABEL: Record<string, string> = {
  "1": "1년",
  "3": "3년",
  "5": "5년",
  "10": "10년",
  "30": "30년",
  permanent: "영구",
};
const RECIPIENT_STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "대기", tone: "muted" },
  sent: { label: "발송됨", tone: "ok" },
  bounced: { label: "발송실패", tone: "danger" },
  delivered_manual: { label: "직접 전달", tone: "ok" },
};

export default async function OfficialDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);

  const { data: doc } = await supabase
    .from("official_documents")
    .select("id, title, body, status, doc_no, disclosure, disclosure_reason, visibility_scope, retention, effective_date, internal_only, approval_document_id, created_by, created_at, sent_at, closed_at, profiles!created_by(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!doc) notFound();

  const recipients = await fetchAllRows<{
    id: string;
    kind: string;
    name: string;
    email: string | null;
    status: string;
    bounce_reason: string | null;
    sent_at: string | null;
  }>((from, to) =>
    supabase
      .from("official_document_recipients")
      .select("id, kind, name, email, status, bounce_reason, sent_at")
      .eq("official_document_id", id)
      .range(from, to),
  );

  const allowManage = canManage(doc.created_by, userId, isAdmin);
  const status = STATUS_LABEL[doc.status] ?? { label: doc.status, tone: "muted" as const };

  let orgTree: ReturnType<typeof buildOrgTree> = [];
  if (allowManage && doc.status === "draft") {
    const [departments, profiles] = await Promise.all([
      fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
        supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
      ),
      fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
        (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
      ),
    ]);
    orgTree = buildOrgTree(
      departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
      profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
    );
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/official-documents" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[var(--erp-text)]">
          공문관리 &gt; {doc.doc_no ? `#${doc.doc_no}` : "상세"}
          <GridBadge tone={status.tone}>{status.label}</GridBadge>
        </h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          {doc.status === "pending_approval" && doc.approval_document_id && (
            <Link href={`/approvals/${doc.approval_document_id}`} className="erp-btn">
              결재 문서 보기
            </Link>
          )}
          {allowManage && doc.status === "draft" && (
            <DeleteButton action={deleteOfficialDocument} id={doc.id} confirmMessage="이 공문(작성중)을 삭제하시겠습니까?" />
          )}
          {allowManage && (doc.status === "draft" || doc.status === "approved") && (
            <OfficialDocumentStatusButton
              id={doc.id}
              action={cancelOfficialDocument}
              label="취소"
              pendingLabel="처리 중..."
              tone="danger"
            />
          )}
          <CloseButton href="/official-documents">✕</CloseButton>
        </div>
      </div>

      <div className="erp-post-body">
        <div className="erp-info-grid mb-3">
          <div className="erp-info-cell">
            <div className="erp-info-label">작성자</div>
            <div className="erp-info-value">{doc.profiles?.full_name ?? "-"}</div>
          </div>
          <div className="erp-info-cell">
            <div className="erp-info-label">작성일</div>
            <div className="erp-info-value">{new Date(doc.created_at).toLocaleDateString("ko-KR")}</div>
          </div>
          <div className="erp-info-cell">
            <div className="erp-info-label">공개구분</div>
            <div className="erp-info-value">{DISCLOSURE_LABEL[doc.disclosure] ?? doc.disclosure}</div>
          </div>
          <div className="erp-info-cell">
            <div className="erp-info-label">보존연한</div>
            <div className="erp-info-value">{RETENTION_LABEL[doc.retention] ?? doc.retention}</div>
          </div>
          {doc.effective_date && (
            <div className="erp-info-cell">
              <div className="erp-info-label">시행일자</div>
              <div className="erp-info-value">{doc.effective_date}</div>
            </div>
          )}
          {doc.sent_at && (
            <div className="erp-info-cell">
              <div className="erp-info-label">발송일시</div>
              <div className="erp-info-value">{new Date(doc.sent_at).toLocaleString("ko-KR")}</div>
            </div>
          )}
        </div>

        <div className="erp-post-title">{doc.title}</div>
        <div className="mt-2 whitespace-pre-wrap text-sm" style={{ color: "var(--erp-text)" }}>
          {doc.body}
        </div>
      </div>

      {!doc.internal_only && (
        <div className="erp-detail" style={{ marginTop: 14 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">수신처 ({recipients.length})</span>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>구분</th>
                    <th>이름</th>
                    <th>이메일</th>
                    <th style={{ width: 100 }}>상태</th>
                    {allowManage && doc.status === "sent" && <th style={{ width: 140 }}>처리</th>}
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => {
                    const rStatus = RECIPIENT_STATUS_LABEL[r.status] ?? { label: r.status, tone: "muted" as const };
                    return (
                      <tr key={r.id}>
                        <td>{r.kind === "external" ? "외부" : "사내"}</td>
                        <td>{r.name}</td>
                        <td style={{ color: "var(--erp-text-muted)" }}>
                          {r.email ?? "-"}
                          {r.bounce_reason && (
                            <div style={{ color: "var(--erp-danger)", fontSize: 10.5 }}>{r.bounce_reason}</div>
                          )}
                        </td>
                        <td>
                          <GridBadge tone={rStatus.tone}>{rStatus.label}</GridBadge>
                        </td>
                        {allowManage && doc.status === "sent" && (
                          <td>
                            {r.status === "pending" || r.status === "bounced" ? (
                              <RecipientManualDeliverButton
                                recipientId={r.id}
                                officialDocumentId={doc.id}
                                action={markRecipientDeliveredManually}
                              />
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {recipients.length === 0 && (
                    <tr>
                      <td colSpan={allowManage && doc.status === "sent" ? 5 : 4} className="erp-grid-empty">
                        수신처가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {allowManage && doc.status === "draft" && (
        <div className="erp-detail" style={{ marginTop: 14 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">결재 상신</span>
          </div>
          <div className="erp-detail-body">
            <OfficialDocumentSubmitForm action={submitOfficialDocumentForApproval} officialDocumentId={doc.id} orgTree={orgTree} />
          </div>
        </div>
      )}

      {allowManage && doc.status === "approved" && (
        <div className="erp-detail" style={{ marginTop: 14 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">발송</span>
          </div>
          <div className="erp-detail-body">
            <SendOfficialDocumentButton id={doc.id} />
          </div>
        </div>
      )}

      {allowManage && doc.status === "sent" && (
        <div className="erp-detail" style={{ marginTop: 14 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">종결</span>
          </div>
          <div className="erp-detail-body">
            <OfficialDocumentStatusButton id={doc.id} action={closeOfficialDocument} label="종결 처리" pendingLabel="처리 중..." tone="primary" />
          </div>
        </div>
      )}
    </div>
  );
}
