import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ReceiptGallery } from "@/components/receipt-gallery";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { PageGuide } from "@/components/erp/page-guide";
import { PrintInPlaceButton } from "@/components/print-in-place-button";
import { GridBadge } from "@/components/grid/badge";
import { PaymentRequestSubmitForm } from "@/components/payment-request-submit-form";
import { paymentRequestDocTitle } from "@/lib/payment-request-title";
import { deletePaymentRequest, submitPaymentRequest, recallPaymentRequestSubmission } from "../actions";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "-";
  const fmt = (d: string) => d.replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

export default async function PaymentRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const { id } = await params;
  const { warning } = await searchParams;
  const supabase = await createClient();
  const [{ data: row }, { data: items }, { data: receipts }, actor, departments, profiles, presetsRaw] =
    await Promise.all([
      supabase
        .from("payment_requests")
        .select(
          "id, title, content, department, period_from, period_to, card_type, created_at, requested_by, status, approval_document_id, decided_at, profiles!requested_by(full_name)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("payment_request_line_items")
        .select("id, used_at, vendor, purpose, amount, remark, is_highlighted")
        .eq("payment_request_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("payment_request_receipts")
        .select("id, file_url, sort_order")
        .eq("payment_request_id", id)
        .order("sort_order", { ascending: true }),
      getCurrentActor(supabase),
      fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
        supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
      ),
      fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
        (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string; approver_ids: string[]; reference_ids: string[] }>((from, to) =>
        supabase.from("approval_line_presets").select("id, name, approver_ids, reference_ids").order("name").range(from, to),
      ),
    ]);

  if (!row) {
    notFound();
  }

  const allowManage = canManage(row.requested_by, actor.userId, actor.isAdmin);
  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );
  const profileNameById: Record<string, string> = {};
  for (const p of profiles) profileNameById[p.id] = p.full_name || "구성원";
  const presets = presetsRaw.map((p) => ({ id: p.id, name: p.name, approverIds: p.approver_ids, referenceIds: p.reference_ids }));
  const total = (items ?? []).reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          ...(allowManage &&
            row.status === "draft" && {
              F4: { href: `/reports/payment-requests/${row.id}/edit` },
            }),
          F9: { printHref: `/reports/payment-requests/${row.id}/print` },
          Escape: { href: "/reports/payment-requests" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        보고서 &gt; 지급결의양식 &gt; 본문{" "}
        <GridBadge tone={(STATUS_LABEL[row.status] ?? { tone: "muted" as const }).tone}>
          {STATUS_LABEL[row.status]?.label ?? row.status}
        </GridBadge>
      </h1>

      <div className="erp-toolbar">
        {allowManage && row.status === "draft" && (
          <Link
            href={`/reports/payment-requests/${row.id}/edit`}
            className="erp-btn"
          >
            F4 수정
          </Link>
        )}
        <PrintInPlaceButton
          href={`/reports/payment-requests/${row.id}/print`}
          className="erp-btn"
        >
          F9 인쇄
        </PrintInPlaceButton>
        {allowManage && row.status === "pending" && (
          // F6(삭제) 단축키는 아래 삭제 버튼 하나로만 써야 하므로(두 개를
          // DeleteButton으로 같이 쓰면 F6에 둘 다 반응하는 문제가 생김)
          // 회수는 InlineConfirmDelete로 별도 확인만 받는다.
          <InlineConfirmDelete
            action={recallPaymentRequestSubmission}
            hiddenFields={{ id: row.id }}
            warningText="제출을 회수하시겠습니까? 다시 작성 상태로 돌아갑니다."
            triggerLabel="회수"
            triggerClassName="erp-btn erp-btn-danger"
          />
        )}
        {allowManage && (
          <DeleteButton
            action={deletePaymentRequest}
            id={row.id}
            confirmMessage="이 지급결의서를 삭제하시겠습니까?"
          />
        )}
        <CloseButton href="/reports/payment-requests">ESC 목록으로</CloseButton>
      </div>

      {warning && (
        <p
          className="mb-3 rounded-sm px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--erp-warning-bg)",
            color: "var(--erp-warning)",
          }}
        >
          ⚠ {warning}
        </p>
      )}

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">
            {paymentRequestDocTitle(row.card_type)}
          </span>
        </div>
        <div className="erp-detail-body">
          <div
            className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm"
            style={{ color: "var(--erp-text-muted)" }}
          >
            <span>부서명: {row.department ?? "-"}</span>
            <span>기간: {formatPeriod(row.period_from, row.period_to)}</span>
            <span>사용카드: {row.card_type}</span>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>
              작성일: {new Date(row.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>

          <div
            className="erp-grid-wrap"
            style={{ border: "1px solid var(--erp-border)" }}
          >
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>일자</th>
                  <th>사용처</th>
                  <th style={{ width: 160 }}>용도</th>
                  <th className="num" style={{ width: 130 }}>
                    금액
                  </th>
                  <th style={{ width: 160 }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item) => (
                  <tr
                    key={item.id}
                    style={
                      item.is_highlighted
                        ? { background: "var(--erp-highlight-bg)" }
                        : undefined
                    }
                  >
                    <td>{item.used_at.replaceAll("-", ".")}</td>
                    <td>{item.vendor}</td>
                    <td>{item.purpose || "-"}</td>
                    <td className="num">
                      {Number(item.amount).toLocaleString()}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {item.remark || "-"}
                    </td>
                  </tr>
                ))}
                {!items?.length && (
                  <tr>
                    <td colSpan={5} className="erp-grid-empty">
                      등록된 사용 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="num" style={{ fontWeight: 700 }}>
                    합계
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {total.toLocaleString()}원
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {row.content && (
            <div
              className="mt-4"
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
            >
              {row.content}
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail" style={{ marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">
            영수증 ({receipts?.length ?? 0}장)
          </span>
        </div>
        <div className="erp-detail-body">
          <ReceiptGallery receipts={receipts ?? []} />
          <PageGuide className="mt-3">영수증 추가·삭제는 F4 수정 화면에서 할 수 있습니다.</PageGuide>
        </div>
      </div>

      {allowManage && row.status === "draft" && (
        <div className="erp-detail" style={{ marginBottom: 12 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">제출(마감)</span>
          </div>
          <div className="erp-detail-body">
            <PageGuide>
              제출하면 사용 내역을 더 이상 추가·수정할 수 없고, 지정한
              결재선을 거쳐 승인/반려됩니다. 아직 아무도 결재하지 않았다면
              위 &quot;회수&quot; 버튼으로 다시 작성 상태로 되돌릴 수 있습니다.
            </PageGuide>
            <PaymentRequestSubmitForm
              action={submitPaymentRequest}
              paymentRequestId={row.id}
              orgTree={orgTree}
              presets={presets}
              profileNameById={profileNameById}
            />
          </div>
        </div>
      )}

      {row.approval_document_id && (
        <div className="erp-detail" style={{ marginBottom: 12 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">결재</span>
          </div>
          <div className="erp-detail-body">
            <Link href={`/approvals/${row.approval_document_id}`} className="erp-btn erp-btn-primary">
              결재 문서 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
