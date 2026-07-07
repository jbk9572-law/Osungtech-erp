import Link from "next/link";
import { PaymentRequestForm } from "@/components/payment-request-form";

export default function NewPaymentRequestPage() {
  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">보고서 &gt; 지급결의양식 &gt; 글쓰기</h1>

      <div className="erp-toolbar">
        <Link href="/reports/payment-requests" className="erp-btn">
          ESC 목록으로
        </Link>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">지급결의서 작성</span>
        </div>
        <div className="erp-detail-body">
          <PaymentRequestForm />
        </div>
      </div>
    </div>
  );
}
