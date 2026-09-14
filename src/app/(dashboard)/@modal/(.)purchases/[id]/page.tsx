import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchaseDetailPage from "@/app/(dashboard)/purchases/[id]/page";

// 인터셉트 라우트: 매입 목록에서 상세보기로 들어가면 실제 /purchases/[id]
// 페이지를 그대로 재사용하면서 목록 화면 위 모달로 띄운다.
export default async function InterceptedPurchaseDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; warning?: string }>;
}) {
  return (
    <RegistrationModalShell size="xl">
      <PurchaseDetailPage {...props} />
    </RegistrationModalShell>
  );
}
