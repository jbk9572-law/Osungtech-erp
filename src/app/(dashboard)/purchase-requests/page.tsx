import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";

const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "작성중", tone: "muted" },
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

export default async function PurchaseRequestsPage() {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("purchase_requests")
    .select(
      "id, request_date, status, converted_purchase_order_id, suppliers(name), purchase_request_items(quantity, estimated_unit_price)",
    )
    .order("request_date", { ascending: false })
    .limit(300);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/purchase-requests/new" }, Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="매입관리 > 구매요청"
        actions={
          <Link href="/purchase-requests/new" className="erp-btn erp-btn-primary">
            F2 구매요청 작성
          </Link>
        }
      />

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>요청일</th>
              <th style={{ width: 160 }}>공급처</th>
              <th className="num" style={{ width: 120 }}>예상합계</th>
              <th style={{ width: 90 }}>상태</th>
              <th style={{ width: 90 }}>발주전환</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((r) => {
              const total = (r.purchase_request_items ?? []).reduce(
                (sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price),
                0,
              );
              const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "muted" as const };
              return (
                <ClickableRow key={r.id} href={`/purchase-requests/${r.id}`}>
                  <td>{r.request_date.replaceAll("-", ".")}</td>
                  <td>{r.suppliers?.name ?? "-"}</td>
                  <td className="num">{total.toLocaleString()}</td>
                  <td>
                    <GridBadge tone={status.tone}>{status.label}</GridBadge>
                  </td>
                  <td>{r.converted_purchase_order_id ? "전환됨" : "-"}</td>
                </ClickableRow>
              );
            })}
            {(!requests || requests.length === 0) && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 구매요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
