import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function PaymentRequestsPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("payment_requests")
    .select("id, title, amount, created_at, profiles(full_name)")
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
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">보고서 &gt; 지급결의양식</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <button type="button" className="erp-btn" disabled title="추후 예정">
          엑셀 다운로드
        </button>
        <Link href="/dashboard" className="erp-btn">
          ESC 닫기
        </Link>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>번호</th>
              <th>제목</th>
              <th style={{ width: 140 }}>작성자</th>
              <th className="num" style={{ width: 160 }}>
                금액
              </th>
              <th style={{ width: 120 }}>작성일</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row, i) => (
              <ClickableRow key={row.id} href={`/reports/payment-requests/${row.id}`}>
                <td className="num">{(rows?.length ?? 0) - i}</td>
                <td>{row.title}</td>
                <td>{row.profiles?.full_name ?? "-"}</td>
                <td className="num">{row.amount != null ? Number(row.amount).toLocaleString() : "-"}</td>
                <td>{new Date(row.created_at).toLocaleDateString("ko-KR")}</td>
              </ClickableRow>
            ))}
            {!rows?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
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
