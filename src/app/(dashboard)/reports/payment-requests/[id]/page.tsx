import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { deletePaymentRequest } from "../actions";

export default async function PaymentRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("payment_requests")
    .select("id, title, content, amount, created_at, profiles(full_name)")
    .eq("id", id)
    .maybeSingle();

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
    </div>
  );
}
