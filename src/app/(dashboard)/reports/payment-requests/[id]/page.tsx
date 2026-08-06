import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { ReceiptDeleteForm } from "@/components/receipt-delete-form";
import { AddReceiptsForm } from "@/components/add-receipts-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { deletePaymentRequest } from "../actions";

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
  const [{ data: row }, { data: receipts }] = await Promise.all([
    supabase
      .from("payment_requests")
      .select("id, title, content, amount, created_at, profiles(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payment_request_receipts")
      .select("id, file_url, sort_order")
      .eq("payment_request_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!row) {
    notFound();
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/reports/payment-requests" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">보고서 &gt; 지급결의양식 &gt; 본문</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests" className="erp-btn erp-btn-danger">
          ESC 목록으로
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
          <span className="erp-detail-tab active">{row.title}</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>작성일: {new Date(row.created_at).toLocaleDateString("ko-KR")}</span>
            {row.amount != null && <span>금액: {Number(row.amount).toLocaleString()}원</span>}
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{row.content || "(내용 없음)"}</div>
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
