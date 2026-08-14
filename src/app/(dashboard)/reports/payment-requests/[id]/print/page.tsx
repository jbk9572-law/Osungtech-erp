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

// 기간 값이 "2026.07.01 ~ 2026.07.31"처럼 길면 칸 너비 안에서 줄바꿈되므로,
// 연도를 두 자리로 줄여 "26.07.01 ~ 26.07.31"로 짧게 표기한다.
function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "";
  const fmt = (d: string) => d.slice(2).replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

// 결재 서류 관례대로 제목처럼 이름 글자 사이도 한 칸씩 띄운다("조준태" → "조 준 태").
function spaceOut(text: string) {
  return text.split("").join(" ");
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  fontSize: 13,
};

// 명세표(일자~비고) 본문 행에 쓰는 스타일. 빈 줄(허전해 보이지 않게 채우는
// 줄)에도 똑같이 써서, 내용이 있는 줄과 높이가 어긋나지 않게 한다.
const itemCellStyle: React.CSSProperties = { ...cellStyle, height: 24 };

// 강조 표시한 줄은 형광펜 느낌의 노란색 음영 + 굵게로 인쇄한다. 회색은
// 컬러로 인쇄해도 눈에 잘 안 띄어서 노란색으로 바꿨다. 브라우저는 기본적
// 으로 인쇄 시 배경색을 생략하므로("배경 그래픽" 옵션을 꺼둔 경우가
// 대부분) print-color-adjust로 강제해 흑백 인쇄에서도 음영이 찍히게 한다.
function highlightCellStyle(isHighlighted: boolean): React.CSSProperties {
  if (!isHighlighted) return itemCellStyle;
  return {
    ...itemCellStyle,
    background: "#ffe066",
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
  const title = printTitle(row.card_type);

  return (
    <div className="mx-auto print-page-margin" style={{ width: 620, maxWidth: "100%" }}>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/reports/payment-requests/${id}`}
          className="print:hidden rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          목록으로
        </Link>
        <PrintButton />
      </div>

      {/* 아래 명세표(일자15% 사용처27% 용도16% 금액18% 비고24%)와 세로선을 완전히
          맞추려고, 이 표도 같은 5칸 폭을 colgroup으로 그대로 쓴다 — title은
          일자+사용처(colSpan 2)로, 결제/담당/팀장은 용도·금액·비고 자리 하나씩을
          그대로 쓴다. 그 덕에 부서명 줄에서도 라벨(일자칸, 15%)보다 값(사용처칸,
          27%)이 더 넓어진다. table-layout: fixed는 원래 "첫 행" 셀의 width만
          컬럼 폭으로 인정하므로(부서명 행처럼 이후 행에 준 width는 무시됨),
          행과 무관하게 폭이 고정되도록 colgroup/col로 직접 지정한다. */}
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", color: "#000" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "21%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td
              colSpan={2}
              rowSpan={3}
              style={{ ...cellStyle, textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: 4 }}
            >
              {title.big}
              {title.sub && (
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, letterSpacing: 0 }}>{title.sub}</div>
              )}
            </td>
            <td style={{ ...cellStyle, textAlign: "center" }} rowSpan={2}>
              결제
            </td>
            <td style={{ ...cellStyle, textAlign: "center" }}>담당</td>
            <td style={{ ...cellStyle, textAlign: "center" }}>팀장</td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, height: 48 }} />
            <td style={{ ...cellStyle, height: 48 }} />
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "center" }}>작성자</td>
            <td style={{ ...cellStyle, textAlign: "center" }} colSpan={2}>
              {row.profiles?.full_name ? spaceOut(row.profiles.full_name) : "-"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 실물 서식처럼 제목/작성자 박스, 부서명 박스, 품목 표를 서로 붙이지
          않고 구간마다 상하 여백을 두어 구분한다(section 별로 별도 표로
          쪼갬). */}
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: 10, color: "#000" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "21%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, textAlign: "center" }}>부서명</td>
            <td style={{ ...cellStyle, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
              {row.department || "-"}
            </td>
            <td style={{ ...cellStyle, textAlign: "center" }}>기간</td>
            <td style={{ ...cellStyle, textAlign: "center", whiteSpace: "nowrap" }} colSpan={2}>
              {formatPeriod(row.period_from, row.period_to)}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: 10, color: "#000" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "21%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...cellStyle, textAlign: "center" }}>일자</th>
            <th style={cellStyle}>사용처</th>
            <th style={{ ...cellStyle, textAlign: "center" }}>용도</th>
            <th style={cellStyle}>금액</th>
            <th style={cellStyle}>비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const s = highlightCellStyle(item.is_highlighted);
            return (
              <tr key={item.id}>
                <td style={{ ...s, textAlign: "center" }}>{item.used_at.replaceAll("-", ".")}</td>
                <td style={s}>{item.vendor}</td>
                <td style={{ ...s, textAlign: "center" }}>{item.purpose || ""}</td>
                <td style={{ ...s, textAlign: "right" }}>{Number(item.amount).toLocaleString()}</td>
                <td style={s}>{item.remark || ""}</td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...itemCellStyle, textAlign: "center", fontWeight: 700 }} colSpan={3}>
              합 계
            </td>
            <td style={{ ...itemCellStyle, textAlign: "right", fontWeight: 700 }}>{total.toLocaleString()}</td>
            <td style={itemCellStyle} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
