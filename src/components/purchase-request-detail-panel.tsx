import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
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
import { formatNumber } from "@/lib/format-number";
import { buildBackHref } from "@/lib/list-return";

const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "작성중", tone: "muted" },
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

// purchase-requests/page.tsx의 목록+상세 분할 화면에서, 목록 옆 패널에
// 이 컴포넌트를 그대로 렌더링한다. 모달/직접 URL 접근
// ([id]/page.tsx)도 같은 컴포넌트를 쓴다.
export async function PurchaseRequestDetailPanel({
  id,
  closeHref,
  selfHref,
}: {
  id: string;
  closeHref: string;
  // "결재 상세 보기"(/approvals/{id})를 눌렀다가 닫으면 구매요청 목록이
  // 아니라 지금 이 구매요청 상세로 돌아와야 한다(사용자 지적). 없으면
  // (선택) 교차 링크에 back을 안 붙인다 — 기존 동작 그대로.
  selfHref?: string;
}) {
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
    <>
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
            <Link href={closeHref} className="erp-btn">
              목록
            </Link>
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
                <td className="num">{formatNumber(Number(item.quantity))}</td>
                <td className="num">{formatNumber(Number(item.estimated_unit_price))}</td>
                <td className="num">{formatNumber((Number(item.quantity) * Number(item.estimated_unit_price)))}</td>
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
                {formatNumber(total)}
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
            <Link
              href={`/approvals/${row.approval_document_id}${selfHref ? `?back=${buildBackHref(selfHref)}` : ""}`}
              className="erp-btn erp-btn-primary"
            >
              결재 문서 보기
            </Link>
          </div>
        </div>
      )}

      {row.status === "approved" &&
        (row.converted_purchase_order_id ? (
          <PageGuide tone="success">
            이 구매요청은 구매발주로 전환되었습니다.{" "}
            <Link href={`/purchases/${row.converted_purchase_order_id}`} style={{ textDecoration: "underline" }}>
              구매발주 전표 보기
            </Link>
          </PageGuide>
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
    </>
  );
}
