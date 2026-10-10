import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import TaxInvoicePage from "@/app/(dashboard)/sales/[id]/tax-invoice/page";

// 인터셉트 라우트: 매출 상세/목록에서 세금계산서로 들어가면 실제
// /sales/[id]/tax-invoice 페이지를 그대로 재사용하면서 모달로 띄운다 —
// 같은 [id] 하위의 상세/수정/인쇄와 동일한 패턴(세금계산서만 빠져있던
// 걸 맞춘다).
export default async function InterceptedTaxInvoicePage(props: { params: Promise<{ id: string }> }) {
  return (
    <RegistrationModalShell size="xl">
      <TaxInvoicePage {...props} />
    </RegistrationModalShell>
  );
}
