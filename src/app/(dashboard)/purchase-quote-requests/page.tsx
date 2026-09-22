import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { GridBadge } from "@/components/grid/badge";

export default async function PurchaseQuoteRequestsPage() {
  const supabase = await createClient();

  const [{ data: requests }, { data: suppliers }] = await Promise.all([
    supabase
      .from("purchase_quote_requests")
      .select(
        "id, request_date, status, memo, target_supplier_ids, converted_purchase_request_id, selected_supplier:suppliers!selected_supplier_id(name), purchase_quote_request_items(id)",
      )
      .order("request_date", { ascending: false })
      .limit(300),
    supabase.from("suppliers").select("id, name").limit(1000),
  ]);

  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/purchase-quote-requests/new" }, Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="매입관리 > 구매 견적요청"
        actions={
          <Link href="/purchase-quote-requests/new" className="erp-btn erp-btn-primary">
            F2 견적요청 작성
          </Link>
        }
      />

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>요청일</th>
              <th>견적 요청한 공급처</th>
              <th className="num" style={{ width: 90 }}>품목 수</th>
              <th style={{ width: 90 }}>상태</th>
              <th style={{ width: 140 }}>확정 공급처</th>
              <th style={{ width: 90 }}>구매요청 전환</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((r) => (
              <ClickableRow key={r.id} href={`/purchase-quote-requests/${r.id}`}>
                <td>{r.request_date.replaceAll("-", ".")}</td>
                <td>{r.target_supplier_ids.map((id) => supplierNameById.get(id) ?? "-").join(", ")}</td>
                <td className="num">{(r.purchase_quote_request_items ?? []).length}</td>
                <td>
                  <GridBadge tone={r.status === "closed" ? "ok" : "warn"}>
                    {r.status === "closed" ? "확정완료" : "비교중"}
                  </GridBadge>
                </td>
                <td>{r.selected_supplier?.name ?? "-"}</td>
                <td>{r.converted_purchase_request_id ? "전환됨" : "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{r.memo ?? "-"}</td>
              </ClickableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  등록된 견적요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
