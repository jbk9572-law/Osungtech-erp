import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentRequestForm } from "@/components/payment-request-form";
import { ReceiptReorderList } from "@/components/receipt-reorder-list";
import { AddReceiptsForm } from "@/components/add-receipts-form";
import { todayKstStr } from "@/lib/kst-date";

export default async function EditPaymentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row }, { data: items }, { data: receipts }] = await Promise.all([
    supabase
      .from("payment_requests")
      .select("id, department, period_from, period_to, card_type")
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

  const today = todayKstStr();

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#182338]">보고서 &gt; 지급결의양식 &gt; 수정</h1>

      <div className="erp-toolbar">
        <Link href={`/reports/payment-requests/${id}`} className="erp-btn erp-btn-danger">
          ESC 취소
        </Link>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">지급결의서(사용내역) 수정</span>
        </div>
        <div className="erp-detail-body">
          <PaymentRequestForm
            defaultDepartment={row.department ?? ""}
            today={today}
            initial={{
              id: row.id,
              department: row.department ?? "",
              periodFrom: row.period_from ?? today,
              periodTo: row.period_to ?? today,
              cardType: row.card_type,
              items: (items ?? []).map((item, i) => ({
                key: `row-${i}`,
                usedAt: item.used_at,
                vendor: item.vendor,
                purpose: item.purpose ?? "",
                amount: String(item.amount),
                remark: item.remark ?? "",
                highlighted: item.is_highlighted,
              })),
            }}
          />
        </div>
      </div>

      <div className="erp-detail" style={{ marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">영수증 ({receipts?.length ?? 0}장)</span>
        </div>
        <div className="erp-detail-body">
          <ReceiptReorderList paymentRequestId={row.id} receipts={receipts ?? []} />
          <AddReceiptsForm paymentRequestId={row.id} />
        </div>
      </div>
    </div>
  );
}
