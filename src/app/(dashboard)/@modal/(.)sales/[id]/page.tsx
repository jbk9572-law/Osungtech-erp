import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import SaleDetailPage from "@/app/(dashboard)/sales/[id]/page";

// 인터셉트 라우트: 매출 목록에서 상세보기로 들어가면 실제 /sales/[id]
// 페이지를 그대로 재사용하면서 목록 화면 위 모달로 띄운다.
export default async function InterceptedSaleDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; warning?: string }>;
}) {
  return (
    <RegistrationModalShell size="xl">
      <SaleDetailPage {...props} />
    </RegistrationModalShell>
  );
}
