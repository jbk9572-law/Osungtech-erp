import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { paymentRequestDocTitle } from "@/lib/payment-request-title";

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "-";
  const fmt = (d: string) => d.replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

// 기간 시작월을 색으로 구분해 목록을 훑어볼 때 몇 월 건인지 한눈에 들어오게
// 한다. 12색이 고르게 퍼지도록 30도씩 색상환을 돌려서 계산한다(별도로
// 12개를 하드코딩할 필요가 없다).
function periodStartMonth(from: string | null): number | null {
  if (!from) return null;
  const month = Number(from.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

function monthBadgeStyle(month: number): React.CSSProperties {
  const hue = (month - 1) * 30;
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    padding: "1px 6px",
    marginRight: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: `hsl(${hue}, 70%, 92%)`,
    color: `hsl(${hue}, 55%, 32%)`,
  };
}

function PeriodCell({ from, to }: { from: string | null; to: string | null }) {
  const month = periodStartMonth(from);
  return (
    <>
      {month && <span style={monthBadgeStyle(month)}>{month}월</span>}
      {formatPeriod(from, to)}
    </>
  );
}

export default async function PaymentRequestsPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("payment_requests")
    .select(
      "id, title, department, period_from, period_to, card_type, created_at, profiles(full_name), payment_request_line_items(amount)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/reports/payment-requests/new" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#182338]">보고서 &gt; 지급결의양식</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <button type="button" className="erp-btn" disabled title="추후 예정">
          엑셀 다운로드
        </button>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th className="num" style={{ width: 70 }}>
                번호
              </th>
              <th style={{ width: 150 }}>구분</th>
              <th style={{ width: 140 }}>부서명</th>
              <th>기간</th>
              <th style={{ width: 110 }}>작성자</th>
              <th className="num" style={{ width: 130 }}>
                합계
              </th>
              <th style={{ width: 100 }}>작성일</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row, i) => {
              const total = (row.payment_request_line_items ?? []).reduce(
                (sum, item) => sum + Number(item.amount),
                0
              );
              return (
                <ClickableRow key={row.id} href={`/reports/payment-requests/${row.id}`}>
                  <td className="num">{(rows?.length ?? 0) - i}</td>
                  <td>{paymentRequestDocTitle(row.card_type)}</td>
                  <td>{row.department || row.title || "-"}</td>
                  <td>
                    <PeriodCell from={row.period_from} to={row.period_to} />
                  </td>
                  <td>{row.profiles?.full_name ?? "-"}</td>
                  <td className="num">{total.toLocaleString()}원</td>
                  <td>{new Date(row.created_at).toLocaleDateString("ko-KR")}</td>
                </ClickableRow>
              );
            })}
            {!rows?.length && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  등록된 지급결의서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
