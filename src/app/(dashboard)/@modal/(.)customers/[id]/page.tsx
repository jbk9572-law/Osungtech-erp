import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import CustomerDetailPage from "@/app/(dashboard)/customers/[id]/page";

// 인터셉트 라우트: 거래처관리 목록에서 거래처를 클릭하면 실제
// /customers/[id] 화면을 그대로 재사용하면서 목록 위 모달로 띄운다.
export default async function InterceptedCustomerDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <CustomerDetailPage {...props} />
    </RegistrationModalShell>
  );
}
