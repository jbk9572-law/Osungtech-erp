import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import InventoryProductHistoryPage from "@/app/(dashboard)/inventory/item/[productId]/page";

// 인터셉트 라우트: 재고현황 목록에서 품목을 클릭하면 실제
// /inventory/item/[productId] 입출고내역 화면을 그대로 재사용하면서 목록
// 위 모달로 띄운다. item/ 한 단계가 더 있는 이유는 그 파일 상단 주석
// 참고 — count/qr-labels 같은 정적 형제 메뉴와 겹치지 않게 하기 위함.
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
