import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import InventoryProductHistoryPage from "@/app/(dashboard)/inventory/[productId]/page";

// 인터셉트 라우트: 재고현황 목록에서 품목을 클릭하면 실제
// /inventory/[productId] 입출고내역 화면을 그대로 재사용하면서 목록 위
// 모달로 띄운다.
export default async function InterceptedInventoryProductHistoryPage(props: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <InventoryProductHistoryPage {...props} />
    </RegistrationModalShell>
  );
}
