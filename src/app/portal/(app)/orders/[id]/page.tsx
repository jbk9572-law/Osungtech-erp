import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format-number";
import { portalHref } from "@/lib/portal-path";

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

const STEP_LABEL: Record<string, string> = { pending: "대기", in_progress: "진행중", done: "완료" };

export default async function PortalOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: orderRows }, { data: items }, { data: steps }] = await Promise.all([
    supabase.rpc("portal_get_order", { p_order_id: id }),
    supabase.rpc("portal_get_order_items", { p_order_id: id }),
    supabase.rpc("portal_get_order_process_steps", { p_order_id: id }),
  ]);

  const order = orderRows?.[0];
  if (!order) notFound();

  const total = (items ?? []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>주문 {order.doc_no}</h1>
        <Link href={await portalHref("/orders")} className="erp-btn">
          목록
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 16 }}>
        {new Date(order.created_at).toLocaleString("ko-KR")}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">진행 상태</span>
        </div>
        <div className="erp-detail-body">
          <span
            className={`erp-badge ${order.status === "rejected" ? "erp-badge-danger" : "erp-badge-info"}`}
            style={{ fontSize: 13, padding: "4px 12px" }}
          >
            {describeProgress(order)}
          </span>
          {order.status === "rejected" && order.reject_reason && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--erp-danger)" }}>반려 사유: {order.reject_reason}</p>
          )}

          {steps && steps.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {steps.map((s) => (
                <span key={s.process_name} className="erp-key-hint" style={{ fontSize: 12 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background:
                        s.status === "done"
                          ? "var(--erp-success)"
                          : s.status === "in_progress"
                            ? "var(--erp-warning)"
                            : "var(--erp-border-strong)",
                    }}
                  />
                  {s.process_name}({STEP_LABEL[s.status]})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">주문 품목</span>
        </div>
        <div className="erp-detail-body">
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>품목</th>
                  <th style={{ width: 90 }}>규격</th>
                  <th className="num" style={{ width: 100 }}>수량</th>
                  <th className="num" style={{ width: 100 }}>단가</th>
                  <th className="num" style={{ width: 120 }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((i) => (
                  <tr key={i.product_id}>
                    <td>{i.name}</td>
                    <td>{i.spec ?? "-"}</td>
                    <td className="num">
                      {formatNumber(i.quantity)} {i.unit}
                    </td>
                    <td className="num">{formatNumber(i.unit_price)}</td>
                    <td className="num">{formatNumber(i.quantity * i.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                    합계
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatNumber(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {order.memo && (
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--erp-text-muted)" }}>요청사항: {order.memo}</p>
          )}
        </div>
      </div>
    </div>
  );
}
