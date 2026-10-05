import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format-number";
import { portalHref } from "@/lib/portal-path";

// work_order_status(생산지시 상태)와 shipping_status(배송 상태)를 조합해
// 거래처가 실제로 궁금한 "지금 어디까지 왔는지" 한 줄로 만든다 — 내부
// 화면처럼 상태 컬럼을 여러 개 늘어놓지 않고, 포털은 이 한 줄만 보여준다.
function describeProgress(row: {
  status: string;
  work_order_status: string | null;
  shipping_status: string;
}): string {
  if (row.status === "requested") return "검토 대기";
  if (row.status === "rejected") return "반려";
  if (row.status === "cancelled") return "취소";
  if (row.shipping_status === "delivered") return "배송완료";
  if (row.shipping_status === "shipped") return "배송중";
  if (row.work_order_status === "completed") return "생산완료(출고대기)";
  if (row.work_order_status === "material_issued") return "생산중";
  if (row.work_order_status === "pending") return "생산대기";
  return "승인됨(처리 대기)";
}

export default async function PortalOrdersPage() {
  const supabase = await createClient();
  const { data: orders, error } = await supabase.rpc("portal_list_orders");
  if (error) {
    return <p style={{ fontSize: 13, color: "var(--erp-danger)" }}>주문 내역을 불러오지 못했습니다.</p>;
  }
  const newHref = await portalHref("/new");
  const ordersHref = await portalHref("/orders");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>주문내역</h1>
        <Link href={newHref} className="erp-btn erp-btn-primary">
          새 발주
        </Link>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>주문번호</th>
              <th style={{ width: 110 }}>주문일</th>
              <th style={{ width: 70 }}>품목수</th>
              <th className="num" style={{ width: 120 }}>합계</th>
              <th style={{ width: 160 }}>진행상태</th>
              <th>요청사항</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`${ordersHref}/${o.id}`} style={{ color: "var(--erp-primary)", fontWeight: 600 }}>
                    {o.doc_no}
                  </Link>
                </td>
                <td>{new Date(o.created_at).toLocaleDateString("ko-KR")}</td>
                <td className="num">{o.item_count}</td>
                <td className="num">{formatNumber(o.total_amount)}</td>
                <td>
                  <span className={`erp-badge ${o.status === "rejected" ? "erp-badge-danger" : "erp-badge-info"}`}>
                    {describeProgress(o)}
                  </span>
                </td>
                <td style={{ color: "var(--erp-text-muted)" }}>{o.memo ?? "-"}</td>
                <td>
                  <Link href={`${ordersHref}/${o.id}`} className="erp-btn" style={{ height: 24, padding: "1px 10px", fontSize: 11 }}>
                    상세보기
                  </Link>
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  아직 주문 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
