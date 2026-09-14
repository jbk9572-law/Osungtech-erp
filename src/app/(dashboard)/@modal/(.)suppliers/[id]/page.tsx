import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import SupplierDetailPage from "@/app/(dashboard)/suppliers/[id]/page";

// 인터셉트 라우트: 거래처관리(공급처) 목록에서 공급처를 클릭하면 실제
// /suppliers/[id] 화면을 그대로 재사용하면서 목록 위 모달로 띄운다.
export default async function InterceptedSupplierDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <SupplierDetailPage {...props} />
    </RegistrationModalShell>
  );
}
