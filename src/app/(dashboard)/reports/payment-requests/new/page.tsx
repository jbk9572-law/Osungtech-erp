import { createClient } from "@/lib/supabase/server";
import { PaymentRequestForm } from "@/components/payment-request-form";
import { todayKstStr } from "@/lib/kst-date";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader } from "@/components/erp/page-header";

export default async function NewPaymentRequestPage() {
  const supabase = await createClient();
  const { data: company } = await supabase.from("company_profile").select("name").maybeSingle();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/reports/payment-requests" } }} />
      <ListPageHeader title="보고서 > 지급결의양식 > 글쓰기" />

      <div className="erp-toolbar">
        <CloseButton href="/reports/payment-requests">ESC 목록으로</CloseButton>
      </div>

      <PaymentRequestForm defaultDepartment={company?.name ?? ""} today={todayKstStr()} />
    </div>
  );
}
