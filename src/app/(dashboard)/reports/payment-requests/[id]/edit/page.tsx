import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentRequestForm } from "@/components/payment-request-form";
import { todayKstStr } from "@/lib/kst-date";

export default async function EditPaymentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row }, { data: items }] = await Promise.all([
    supabase.from("payment_requests").select("id, department, period_from, period_to").eq("id", id).maybeSingle(),
    supabase
      .from("payment_request_line_items")
      .select("id, used_at, vendor, purpose, amount, card_type, remark")
      .eq("payment_request_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!row) {
    notFound();
  }

  const today = todayKstStr();

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">보고서 &gt; 지급결의양식 &gt; 수정</h1>

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
              items: (items ?? []).map((item, i) => ({
                key: `row-${i}`,
                usedAt: item.used_at,
                vendor: item.vendor,
                purpose: item.purpose ?? "",
                amount: String(item.amount),
                cardType: item.card_type,
                remark: item.remark ?? "",
              })),
            }}
          />
        </div>
      </div>
    </div>
  );
}
