import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import TaxInvoiceCorrectionPage from "@/app/(dashboard)/sales/[id]/tax-invoice/correct/page";

// 인터셉트 라우트: /sales/[id]/tax-invoice/page.tsx와 동일한 이유로
// 수정세금계산서 화면도 모달로 띄운다.
export default async function InterceptedTaxInvoiceCorrectionPage(props: { params: Promise<{ id: string }> }) {
  return (
    <RegistrationModalShell size="xl">
      <TaxInvoiceCorrectionPage {...props} />
    </RegistrationModalShell>
  );
}
