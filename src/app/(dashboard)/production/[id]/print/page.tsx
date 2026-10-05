import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { formatNumber } from "@/lib/format-number";

// 실물(완제품/반제품)과 함께 사내·외부 업체를 오가는 생산지시서(작업지시서)
// 출력물. 공정 수는 품목마다 달라 10개씩 고정 칸 높이로 페이지를 나누고
// (/design 캔버스로 먼저 합의한 레이아웃 — 칸이 유기적으로 늘어나면
// 페이지마다 줄 높이가 들쭉날쭉해 보기 안 좋다는 지적), 앞면에만 제품정보
// +도면+특이사항을 싣고 뒷면(2페이지 이상)은 LOT/품목만 간단히 반복한다.
const ROWS_PER_PAGE = 10;

const cellStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  fontSize: 12,
  color: "#000",
};

const thStyle: React.CSSProperties = {
  ...cellStyle,
  background: "#f0f1f3",
  fontWeight: 700,
  textAlign: "left",
  whiteSpace: "nowrap",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

export default async function WorkOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: workOrder }, { data: stepRows }] = await Promise.all([
    supabase
      .from("work_orders")
      .select("doc_no, order_date, quantity, memo, products(name, spec, unit)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("work_order_process_steps")
      .select("id, process_name, sort_order, assignee_kind, subcontractors(name)")
      .eq("work_order_id", id)
      .order("sort_order"),
  ]);

  if (!workOrder) notFound();

  const steps = stepRows ?? [];
  const pages: (typeof steps)[] = [];
  for (let i = 0; i < steps.length; i += ROWS_PER_PAGE) {
    pages.push(steps.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const docNo = `WO-${workOrder.doc_no}`;
  const today = new Date().toLocaleDateString("ko-KR").replaceAll(" ", "");

  return (
    <div className="mx-auto print-page-margin" style={{ width: 760, maxWidth: "100%", color: "#000" }}>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/production/${id}`} className="erp-btn erp-btn-dark">
          목록으로
        </Link>
        <PrintButton />
      </div>

      {pages.map((pageSteps, pageIndex) => {
        const isFirst = pageIndex === 0;
        return (
          <div key={pageIndex} className={pageIndex < pages.length - 1 ? "print-page-break" : undefined}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                borderBottom: "3px solid #132944",
                paddingBottom: 8,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em" }}>ELVONIX ERP · 생산관리</div>
                <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "0.02em" }}>
                  생산지시서 (작업지시서){!isFirst && " — 이어서"}
                </h1>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "#444" }}>
                <div>
                  문서번호: <b>{docNo}</b>
                </div>
                <div>
                  {isFirst ? `출력일: ${today}` : `앞면 공정에 이어서`} · {pageIndex + 1}/{pages.length}장
                </div>
              </div>
            </div>

            {isFirst ? (
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 90 }} />
                  <col />
                  <col style={{ width: 90 }} />
                  <col />
                </colgroup>
                <tbody>
                  <tr>
                    <th style={thStyle}>지시일자</th>
                    <td style={cellStyle}>{workOrder.order_date.replaceAll("-", ".")}</td>
                    <th style={thStyle}>LOT번호</th>
                    <td style={cellStyle}>LOT {workOrder.doc_no}</td>
                  </tr>
                  <tr>
                    <th style={thStyle}>품목명</th>
                    <td style={cellStyle} colSpan={3}>
                      {workOrder.products?.name ?? "-"}
                    </td>
                  </tr>
                  <tr>
                    <th style={thStyle}>규격</th>
                    <td style={cellStyle}>{workOrder.products?.spec || "-"}</td>
                    <th style={thStyle}>수량</th>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {formatNumber(Number(workOrder.quantity))} {workOrder.products?.unit}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 90 }} />
                  <col />
                  <col style={{ width: 90 }} />
                  <col />
                </colgroup>
                <tbody>
                  <tr>
                    <th style={thStyle}>LOT번호</th>
                    <td style={cellStyle}>LOT {workOrder.doc_no}</td>
                    <th style={thStyle}>품목명</th>
                    <td style={cellStyle}>
                      {workOrder.products?.name ?? "-"}
                      {workOrder.products?.spec && ` (${workOrder.products.spec})`}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {isFirst && (
              <div style={{ display: "flex", border: "1px solid #333", height: 220, marginTop: 10 }}>
                <div
                  style={{
                    flex: 1,
                    borderRight: "1px solid #333",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ position: "absolute", top: 6, left: 8, fontSize: 11, fontWeight: 700, color: "#555" }}>
                    도면
                  </span>
                  <span style={{ color: "#aaa", fontSize: 12 }}>[도면 삽입 영역]</span>
                </div>
                <div style={{ flex: 1, position: "relative", padding: "24px 10px 10px" }}>
                  <span style={{ position: "absolute", top: 6, left: 8, fontSize: 11, fontWeight: 700, color: "#555" }}>
                    특이사항
                  </span>
                  {workOrder.memo && (
                    <div style={{ fontSize: 11, color: "#333", marginBottom: 6 }}>{workOrder.memo}</div>
                  )}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} style={{ borderBottom: "1px solid #ccc", height: 20 }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>
              공정 진행 체크리스트{!isFirst && " (이어서)"} — 공정마다 받을 때(인수)·끝낼 때(완료) 서명
            </div>

            {pageSteps.length === 0 ? (
              <p style={{ fontSize: 12, color: "#666", padding: "8px 0" }}>등록된 공정이 없습니다.</p>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: 10 }}>
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "center" }}>순서</th>
                    <th style={thStyle}>공정명</th>
                    <th style={thStyle}>담당(사내/업체)</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>인수(일자·서명)</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>완료(일자·서명)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSteps.map((s) => (
                    <tr key={s.id} style={{ breakInside: "avoid" }}>
                      <td style={{ ...cellStyle, textAlign: "center", height: 34 }}>{s.sort_order}</td>
                      <td style={{ ...cellStyle, height: 34 }}>{s.process_name}</td>
                      <td style={{ ...cellStyle, height: 34 }}>
                        {s.assignee_kind === "internal" ? "사내" : (s.subcontractors?.name ?? "업체")}
                      </td>
                      <td style={{ ...cellStyle, height: 34 }} />
                      <td style={{ ...cellStyle, height: 34 }} />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ fontSize: 10.5, color: "#666", textAlign: "center", marginTop: 14 }}>
              이 문서는 생산지시서 원본과 함께 실물에 동봉해 공정마다(사내 ↔ 외부 업체 포함) 전달합니다. 공정이 한
              장에 다 들어가지 않으면 별도 서식이 아니라 이 서식의 뒷면에 이어서 찍힙니다.
            </div>
          </div>
        );
      })}
    </div>
  );
}
