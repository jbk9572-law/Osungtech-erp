import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { CloseButton } from "@/components/erp/close-button";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { ConvertPurchaseRequestForm } from "@/components/convert-purchase-request-form";
import { PurchaseRequestSubmitForm } from "@/components/purchase-request-submit-form";
import {
  deletePurchaseRequest,
  submitPurchaseRequest,
  recallPurchaseRequestSubmission,
} from "@/app/(dashboard)/purchase-requests/actions";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "작성중", tone: "muted" },
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: row }, { data: items }, { data: warehouses }, actor, departments, profiles, presetsRaw] =
    await Promise.all([
      supabase
        .from("purchase_requests")
        .select(
          "id, request_date, memo, status, approval_document_id, decided_at, converted_purchase_order_id, requested_by, created_at, suppliers(name), profiles!requested_by(full_name)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("purchase_request_items")
        .select("id, spec, quantity, estimated_unit_price, remark, products(sku, name)")
        .eq("purchase_request_id", id),
      supabase.from("warehouses").select("id, name").order("name"),
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

  if (!row) notFound();

  const allowManage = canManage(row.requested_by, actor.userId, actor.isAdmin);
  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );
  const profileNameById: Record<string, string> = {};
  for (const p of profiles) profileNameById[p.id] = p.full_name || "구성원";
  const presets = presetsRaw.map((p) => ({ id: p.id, name: p.name, approverIds: p.approver_ids, referenceIds: p.reference_ids }));

  const total = (items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price), 0);
  const status = STATUS_LABEL[row.status] ?? { label: row.status, tone: "muted" as const };

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchase-requests" } }} />
      <DetailPageHeader
        title={`구매요청 · ${row.suppliers?.name ?? "-"}`}
        meta={
          <>
            요청일 {row.request_date.replaceAll("-", ".")} · 작성자 {row.profiles?.full_name ?? "-"}
          </>
        }
        actions={
          <>
            {allowManage && row.status === "pending" && (
              <InlineConfirmDelete
                action={recallPurchaseRequestSubmission}
                hiddenFields={{ id: row.id }}
                warningText="제출을 회수하시겠습니까? 다시 작성 상태로 돌아갑니다."
                triggerLabel="회수"
                triggerClassName="erp-btn erp-btn-danger"
              />
            )}
            {allowManage && (
              <DeleteButton action={deletePurchaseRequest} id={row.id} confirmMessage="이 구매요청을 삭제하시겠습니까?" />
            )}
            <CloseButton href="/purchase-requests">ESC 목록으로</CloseButton>
          </>
        }
      />

      <div className="mb-3">
        <GridBadge tone={status.tone}>{status.label}</GridBadge>
      </div>

      {row.memo && (
        <p className="mb-3 text-sm" style={{ color: "var(--erp-text-muted)" }}>
          메모: {row.memo}
        </p>
      )}

      <div className="erp-grid-wrap" style={{ marginBottom: 16 }}>
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th className="num" style={{ width: 110 }}>예상단가</th>
              <th className="num" style={{ width: 110 }}>예상금액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.products?.name ?? "-"}</td>
                <td>{item.spec ?? "-"}</td>
                <td className="num">{Number(item.quantity).toLocaleString()}</td>
                <td className="num">{Number(item.estimated_unit_price).toLocaleString()}</td>
                <td className="num">{(Number(item.quantity) * Number(item.estimated_unit_price)).toLocaleString()}</td>
                <td>{item.remark ?? "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="num" style={{ fontWeight: 700 }}>
                합계
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                {total.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {allowManage && row.status === "draft" && (
        <div className="erp-detail" style={{ marginBottom: 12 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">제출(결재 요청)</span>
          </div>
          <div className="erp-detail-body">
            <PageGuide>
              제출하면 지정한 결재선을 거쳐 승인/반려됩니다. 아직 아무도 결재하지 않았다면 위
              &quot;회수&quot; 버튼으로 다시 작성 상태로 되돌릴 수 있습니다.
            </PageGuide>
            <PurchaseRequestSubmitForm
              action={submitPurchaseRequest}
              purchaseRequestId={row.id}
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

      {row.status === "approved" &&
        (row.converted_purchase_order_id ? (
          <p
            className="mb-4 rounded p-2 text-xs"
            style={{ background: "var(--erp-success-bg)", color: "var(--erp-success)", border: "1px solid var(--erp-success-border)" }}
          >
            이 구매요청은 구매발주로 전환되었습니다.{" "}
            <Link href={`/purchases/${row.converted_purchase_order_id}`} style={{ textDecoration: "underline" }}>
              구매발주 전표 보기
            </Link>
          </p>
        ) : (
          <div className="erp-detail" style={{ marginBottom: 12 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">구매발주로 전환</span>
            </div>
            <div className="erp-detail-body">
              <PageGuide>
                품목을 다시 입력할 필요 없이, 이 구매요청 내용 그대로 구매발주 전표를 생성합니다. 전환할
                창고만 선택해주세요.
              </PageGuide>
              <ConvertPurchaseRequestForm purchaseRequestId={row.id} warehouses={warehouses ?? []} />
            </div>
          </div>
        ))}
    </div>
  );
}
