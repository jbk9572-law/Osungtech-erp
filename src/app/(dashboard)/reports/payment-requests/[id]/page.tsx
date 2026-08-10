import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { ReceiptGallery } from "@/components/receipt-gallery";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PrintInPlaceButton } from "@/components/print-in-place-button";
import { paymentRequestDocTitle } from "@/lib/payment-request-title";
import { deletePaymentRequest } from "../actions";

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "-";
  const fmt = (d: string) => d.replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

export default async function PaymentRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const { id } = await params;
  const { warning } = await searchParams;
  const supabase = await createClient();
  const [{ data: row }, { data: items }, { data: receipts }] = await Promise.all([
    supabase
      .from("payment_requests")
      .select("id, title, content, department, period_from, period_to, card_type, created_at, profiles(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payment_request_line_items")
      .select("id, used_at, vendor, purpose, amount, remark, is_highlighted")
      .eq("payment_request_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("payment_request_receipts")
      .select("id, file_url, sort_order")
      .eq("payment_request_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!row) {
    notFound();
  }

  const total = (items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F4: { href: `/reports/payment-requests/${row.id}/edit` },
          F9: { printHref: `/reports/payment-requests/${row.id}/print` },
          Escape: { href: "/reports/payment-requests" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#182338]">보고서 &gt; 지급결의양식 &gt; 본문</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
        <Link href={`/reports/payment-requests/${row.id}/edit`} className="erp-btn">
          F4 수정
        </Link>
        <PrintInPlaceButton href={`/reports/payment-requests/${row.id}/print`} className="erp-btn">
          F9 인쇄
        </PrintInPlaceButton>
        <DeleteButton action={deletePaymentRequest} id={row.id} confirmMessage="이 지급결의서를 삭제하시겠습니까?" />
      </div>

      {warning && (
        <p
          className="mb-3 rounded-sm px-3 py-2 text-xs font-medium"
          style={{ background: "#fdf3e0", color: "var(--erp-warning)" }}
        >
          ⚠ {warning}
        </p>
      )}

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{paymentRequestDocTitle(row.card_type)}</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>부서명: {row.department ?? "-"}</span>
            <span>기간: {formatPeriod(row.period_from, row.period_to)}</span>
            <span>사용카드: {row.card_type}</span>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>작성일: {new Date(row.created_at).toLocaleDateString("ko-KR")}</span>
          </div>

          <div className="erp-grid-wrap" style={{ border: "1px solid var(--erp-border)" }}>
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>일자</th>
                  <th>사용처</th>
                  <th style={{ width: 160 }}>용도</th>
                  <th className="num" style={{ width: 130 }}>
                    금액
                  </th>
                  <th style={{ width: 160 }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item) => (
                  <tr key={item.id} style={item.is_highlighted ? { background: "#fff7d6" } : undefined}>
                    <td>{item.used_at.replaceAll("-", ".")}</td>
                    <td>{item.vendor}</td>
                    <td>{item.purpose || "-"}</td>
                    <td className="num">{Number(item.amount).toLocaleString()}</td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{item.remark || "-"}</td>
                  </tr>
                ))}
                {!items?.length && (
                  <tr>
                    <td colSpan={5} className="erp-grid-empty">
                      등록된 사용 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="num" style={{ fontWeight: 700 }}>
                    합계
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {total.toLocaleString()}원
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {row.content && (
            <div className="mt-4" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {row.content}
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail" style={{ marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">영수증 ({receipts?.length ?? 0}장)</span>
        </div>
        <div className="erp-detail-body">
          <ReceiptGallery receipts={receipts ?? []} />
          <p className="mt-3 text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
            영수증 추가·삭제는 F4 수정 화면에서 할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
