import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaymentRequestForm } from "@/components/payment-request-form";
import { todayKstStr } from "@/lib/kst-date";

export default async function NewPaymentRequestPage() {
  const supabase = await createClient();
  const { data: company } = await supabase.from("company_profile").select("name").eq("id", 1).maybeSingle();

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">보고서 &gt; 지급결의양식 &gt; 글쓰기</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">지급결의서(사용내역) 작성</span>
        </div>
        <div className="erp-detail-body">
          <PaymentRequestForm defaultDepartment={company?.name ?? ""} today={todayKstStr()} />
        </div>
      </div>
    </div>
  );
}
