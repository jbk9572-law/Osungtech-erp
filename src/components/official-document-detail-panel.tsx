import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { GridBadge } from "@/components/grid/badge";
import { DetailPageHeader } from "@/components/erp/page-header";
import { RichTextView } from "@/components/erp/rich-text-view";
import { DeleteButton } from "@/components/delete-button";
import { OfficialDocumentSubmitForm } from "@/components/official-document-submit-form";
import { OfficialDocumentStatusButton } from "@/components/official-document-status-button";
import { SendOfficialDocumentButton } from "@/components/send-official-document-button";
import { RecipientManualDeliverButton } from "@/components/recipient-manual-deliver-button";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";
import { resolveStatusLabel } from "@/lib/status-label";
import {
  deleteOfficialDocument,
  submitOfficialDocumentForApproval,
  closeOfficialDocument,
  cancelOfficialDocument,
  markRecipientDeliveredManually,
} from "@/app/(dashboard)/official-documents/actions";
import { buildBackHref } from "@/lib/list-return";

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

// official-documents-list.tsx의 목록+상세 분할 화면에서, 목록 옆 패널에 이
// 컴포넌트를 그대로 렌더링한다. 모달/직접 URL 접근
// (official-documents/[id]/page.tsx)도 같은 컴포넌트를 쓴다.
export async function OfficialDocumentDetailPanel({
  id,
  closeHref,
  selfHref,
}: {
  id: string;
  closeHref: string;
  // "결재 문서 보기"(/approvals/{id})를 눌렀다가 닫으면 공문함 목록이
  // 아니라 지금 이 공문 상세로 돌아와야 한다(사용자 지적). 없으면
  // (선택) 교차 링크에 back을 안 붙인다 — 기존 동작 그대로.
  selfHref?: string;
}) {
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);

  const { data: doc } = await supabase
    .from("official_documents")
    .select(
      "id, title, body, status, doc_no, doc_no_year, disclosure, disclosure_reason, visibility_scope, retention, effective_date, internal_only, approval_document_id, created_by, created_at, sent_at, closed_at, profiles!created_by(full_name)",
    )
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
  const status = resolveStatusLabel(STATUS_LABEL, doc.status);

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
    <>
      <DetailPageHeader
        title={`공문관리 > ${doc.doc_no ? `#${doc.doc_no_year}-${doc.doc_no}` : "상세"}`}
        meta={<GridBadge tone={status.tone}>{status.label}</GridBadge>}
        actions={
          <>
            {doc.status === "pending_approval" && doc.approval_document_id && (
              <Link
                href={`/approvals/${doc.approval_document_id}${selfHref ? `?back=${buildBackHref(selfHref)}` : ""}`}
                className="erp-btn"
              >
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
            <Link href={closeHref} className="erp-btn">
              목록
            </Link>
          </>
        }
      />

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
        {/* body는 스마트에디터(리치텍스트)로 작성된 HTML이다. 병합필드 치환
            값은 lib/document-template.ts의 renderTemplate이 이미
            이스케이프해서 넣지만, 공문 본문(템플릿) 자체는 에디터를
            거치지 않고 저장될 수 있으므로 RichTextView가 렌더링 전
            한 번 더 걸러낸다. */}
        <RichTextView
          html={doc.body}
          className="erp-richtext-content mt-2 text-sm"
          style={{ color: "var(--erp-text)", padding: "10px 0" }}
        />
      </div>

      {!doc.internal_only && (
        <div className="erp-detail" style={{ marginTop: 14 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">수신처 ({recipients.length})</span>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap has-card-view">
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
                    const rStatus = resolveStatusLabel(RECIPIENT_STATUS_LABEL, r.status);
                    return (
                      <tr key={r.id}>
                        <td>{r.kind === "external" ? "외부" : "사내"}</td>
                        <td>{r.name}</td>
                        <td style={{ color: "var(--erp-text-muted)" }}>
                          {r.email ?? "-"}
                          {r.bounce_reason && (
                            <div style={{ color: "var(--erp-danger)", fontSize: "var(--erp-font-xs)" }}>{r.bounce_reason}</div>
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

            <div className="erp-row-card-list">
              {recipients.map((r) => {
                const rStatus = resolveStatusLabel(RECIPIENT_STATUS_LABEL, r.status);
                return (
                  <div className="erp-row-card" key={r.id}>
                    <div className="erp-row-card-head">
                      <span className="erp-row-card-partner">{r.name}</span>
                      <GridBadge tone={rStatus.tone}>{rStatus.label}</GridBadge>
                    </div>
                    <dl className="erp-order-item-fields">
                      <div>
                        <dt>구분</dt>
                        <dd>{r.kind === "external" ? "외부" : "사내"}</dd>
                      </div>
                      <div>
                        <dt>이메일</dt>
                        <dd>{r.email ?? "-"}</dd>
                      </div>
                      {r.bounce_reason && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <dt>발송실패 사유</dt>
                          <dd style={{ color: "var(--erp-danger)" }}>{r.bounce_reason}</dd>
                        </div>
                      )}
                    </dl>
                    {allowManage && doc.status === "sent" && (r.status === "pending" || r.status === "bounced") && (
                      <div style={{ marginTop: 4 }}>
                        <RecipientManualDeliverButton
                          recipientId={r.id}
                          officialDocumentId={doc.id}
                          action={markRecipientDeliveredManually}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {recipients.length === 0 && <p className="erp-grid-empty">수신처가 없습니다.</p>}
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
    </>
  );
}
