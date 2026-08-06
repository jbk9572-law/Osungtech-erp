import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { ReceiptDeleteForm } from "@/components/receipt-delete-form";
import { AddReceiptsForm } from "@/components/add-receipts-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
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
      .select("id, used_at, vendor, purpose, amount, remark")
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
          F9: { href: `/reports/payment-requests/${row.id}/print`, newTab: true },
          Escape: { href: "/reports/payment-requests" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">보고서 &gt; 지급결의양식 &gt; 본문</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
        <Link href={`/reports/payment-requests/${row.id}/edit`} className="erp-btn">
          F4 수정
        </Link>
        <Link href={`/reports/payment-requests/${row.id}/print`} target="_blank" rel="noopener noreferrer" className="erp-btn">
          F9 인쇄
        </Link>
        <DeleteButton action={deletePaymentRequest} id={row.id} confirmMessage="이 지급결의서를 삭제하시겠습니까?" />
      </div>

      {warning && (
        <p
          className="mb-3 rounded-sm px-3 py-2 text-xs font-medium"
          style={{ background: "#fdf3e0", color: "#a15c00" }}
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
                  <tr key={item.id}>
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
          {receipts && receipts.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-3">
              {receipts.map((receipt, index) => (
                <li
                  key={receipt.id}
                  className="flex flex-col items-center gap-1 rounded-sm border p-2"
                  style={{ borderColor: "var(--erp-border)", width: 108 }}
                >
                  <a href={receipt.file_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receipt.file_url}
                      alt={`영수증 ${index + 1}`}
                      style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 4 }}
                    />
                  </a>
                  <span className="text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
                    #{index + 1}
                  </span>
                  <ReceiptDeleteForm id={receipt.id} paymentRequestId={row.id} />
                </li>
              ))}
            </ul>
          )}
          <AddReceiptsForm paymentRequestId={row.id} />
        </div>
      </div>
    </div>
  );
}
