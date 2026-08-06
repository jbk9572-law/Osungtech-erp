import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

// 개인카드로 쓴 문서는 "지급결의양식", 법인카드(하나/신한)로 쓴 문서는
// "사용내역" 큰 제목에 어느 카드인지 작게 덧붙여 표시한다 — 실제로는
// 카드별로 문서를 따로 작성하기 때문에(신한 내역은 신한 문서에만) 제목만
// 봐도 어느 카드 건인지 구분되어야 한다.
function printTitle(cardType: string | null): { big: string; sub: string | null } {
  if (!cardType || cardType === "개인카드") return { big: "지 급 결 의 양 식", sub: null };
  return { big: "사 용 내 역", sub: `(${cardType})` };
}

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "";
  const fmt = (d: string) => d.replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  fontSize: 13,
};

// 강조 표시한 줄은 회색 음영 + 굵게로 인쇄한다. 브라우저는 기본적으로
// 인쇄 시 배경색을 생략하므로("배경 그래픽" 옵션을 꺼둔 경우가 대부분)
// print-color-adjust로 강제해 흑백 인쇄에서도 음영이 실제로 찍히게 한다.
function highlightCellStyle(isHighlighted: boolean): React.CSSProperties {
  if (!isHighlighted) return cellStyle;
  return {
    ...cellStyle,
    background: "#d4d4d4",
    fontWeight: 700,
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  } as React.CSSProperties;
}

// 회사에서 실제 쓰는 지급결의(사용내역) 종이 양식을 그대로 재현한 인쇄용
// 페이지. 화면에서 보는 erp-grid 스타일 표와는 별개로, 인쇄물은 실제 서류
// 그대로(검은 테두리, 결제 담당/팀장 도장란 포함) 나와야 하므로 여기서만
// 쓰는 표를 직접 그린다.
export default async function PaymentRequestPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row }, { data: items }] = await Promise.all([
    supabase
      .from("payment_requests")
      .select("id, department, period_from, period_to, card_type, profiles(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payment_request_line_items")
      .select("id, used_at, vendor, purpose, amount, remark, is_highlighted")
      .eq("payment_request_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!row) {
    notFound();
  }

  const total = (items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const rows = items ?? [];
  // 물리 양식처럼 표 아래쪽에 빈 줄을 몇 개 채워서 허전해 보이지 않게 한다.
  const blankRowCount = Math.max(0, 18 - rows.length);
  const title = printTitle(row.card_type);

  return (
    <div className="mx-auto print:mx-0" style={{ width: 620, maxWidth: "100%" }}>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/reports/payment-requests/${id}`} className="erp-btn erp-btn-danger">
          목록으로
        </Link>
        <PrintButton />
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", color: "#000" }}>
        <tbody>
          <tr>
            <td
              rowSpan={3}
              style={{ ...cellStyle, width: "40%", textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: 4 }}
            >
              {title.big}
              {title.sub && (
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, letterSpacing: 0 }}>{title.sub}</div>
              )}
            </td>
            <td style={{ ...cellStyle, width: "15%", textAlign: "center" }} rowSpan={2}>
              결제
            </td>
            <td style={{ ...cellStyle, width: "22.5%", textAlign: "center" }}>담당</td>
            <td style={{ ...cellStyle, width: "22.5%", textAlign: "center" }}>팀장</td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, height: 48 }} />
            <td style={{ ...cellStyle, height: 48 }} />
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "center" }}>작성자</td>
            <td style={cellStyle} colSpan={2}>
              {row.profiles?.full_name ?? "-"}
            </td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "center" }}>부서명</td>
            <td style={cellStyle}>{row.department || "-"}</td>
            <td style={{ ...cellStyle, textAlign: "center" }}>기간</td>
            <td style={cellStyle}>{formatPeriod(row.period_from, row.period_to)}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: -1, color: "#000" }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, width: "15%" }}>일자</th>
            <th style={{ ...cellStyle, width: "27%" }}>사용처</th>
            <th style={{ ...cellStyle, width: "16%" }}>용도</th>
            <th style={{ ...cellStyle, width: "18%" }}>금액</th>
            <th style={{ ...cellStyle, width: "24%" }}>비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const s = highlightCellStyle(item.is_highlighted);
            return (
              <tr key={item.id}>
                <td style={s}>{item.used_at.replaceAll("-", ".")}</td>
                <td style={s}>{item.vendor}</td>
                <td style={s}>{item.purpose || ""}</td>
                <td style={{ ...s, textAlign: "right" }}>{Number(item.amount).toLocaleString()}</td>
                <td style={s}>{item.remark || ""}</td>
              </tr>
            );
          })}
          {Array.from({ length: blankRowCount }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td style={{ ...cellStyle, height: 22 }} />
              <td style={cellStyle} />
              <td style={cellStyle} />
              <td style={cellStyle} />
              <td style={cellStyle} />
            </tr>
          ))}
          <tr>
            <td style={{ ...cellStyle, textAlign: "center", fontWeight: 700 }} colSpan={3}>
              합 계
            </td>
            <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700 }}>{total.toLocaleString()}</td>
            <td style={cellStyle} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
