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

type TrackStage = { name: string; mark: string; filled: boolean; current: boolean };

// 택배 조회 화면처럼 "지금 어디까지 왔는지"를 한눈에 보여주는 단계
// 트래커 — 우리가 직접 만드는 품목(생산 단계가 있음)인지, 사입해서
// 그대로 파는 품목(생산 단계 없이 승인되면 바로 배송 준비)인지에 따라
// 단계 개수 자체가 다르다.
function buildTrackStages(order: {
  status: string;
  work_order_status: string | null;
  shipping_status: string;
}): { stageNames: string[]; steps: TrackStage[] } {
  const hasProduction = order.work_order_status !== null;
  const stageNames = hasProduction ? ["요청", "승인", "생산", "배송", "완료"] : ["요청", "승인", "배송", "완료"];

  let stageIndex = 0;
  if (order.status === "requested") {
    stageIndex = 0;
  } else if (order.shipping_status === "delivered") {
    stageIndex = stageNames.length - 1;
  } else if (order.shipping_status === "shipped") {
    stageIndex = stageNames.length - 2;
  } else if (hasProduction) {
    stageIndex = 2; // 승인됨 + 생산 단계가 있음 → "생산" 단계가 진행 중
  } else {
    stageIndex = 1; // 승인됨, 생산 단계 없음(사입품) → "승인" 다음은 바로 배송 대기
  }

  const steps: TrackStage[] = stageNames.map((name, idx) => ({
    name,
    mark: idx < stageIndex ? "✓" : String(idx + 1),
    filled: idx <= stageIndex,
    current: idx === stageIndex,
  }));
  return { stageNames, steps };
}

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
          {order.status === "rejected" || order.status === "cancelled" ? (
            <>
              <span className="erp-badge erp-badge-danger" style={{ fontSize: 13, padding: "4px 12px" }}>
                {describeProgress(order)}
              </span>
              {order.status === "rejected" && order.reject_reason && (
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--erp-danger)" }}>반려 사유: {order.reject_reason}</p>
              )}
            </>
          ) : (
            (() => {
              const { steps: trackSteps } = buildTrackStages(order);
              return (
                <div style={{ position: "relative", padding: "6px 4px 2px" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: 17,
                      left: `calc(100% / ${trackSteps.length} / 2)`,
                      right: `calc(100% / ${trackSteps.length} / 2)`,
                      height: 2,
                      background: "var(--erp-border-strong)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 17,
                      left: `calc(100% / ${trackSteps.length} / 2)`,
                      height: 2,
                      background: "var(--erp-primary)",
                      width: `calc(100% / ${trackSteps.length} * ${Math.max(0, trackSteps.filter((s) => s.filled).length - 1)})`,
                    }}
                  />
                  <div style={{ position: "relative", display: "flex" }}>
                    {trackSteps.map((s) => (
                      <div key={s.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 0,
                            boxSizing: "border-box",
                            background: s.filled ? "var(--erp-primary)" : "#fff",
                            border: `2px solid ${s.filled ? "var(--erp-primary)" : "var(--erp-border-strong)"}`,
                            color: s.filled ? "#fff" : "var(--erp-text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {s.mark}
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: s.current ? 700 : 500,
                            color: s.current ? "var(--erp-primary)" : s.filled ? "var(--erp-text)" : "var(--erp-text-muted)",
                          }}
                        >
                          {s.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

          {steps && steps.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <p style={{ fontSize: 11.5, color: "var(--erp-text-muted)", marginBottom: 6 }}>공정별 진행상황</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
