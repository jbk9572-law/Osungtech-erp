import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewPurchasePage from "@/app/(dashboard)/purchases/new/page";

// 인터셉트 라우트: /purchases 목록에서 "새 거래 등록"으로 이동하면 이 경로가
// 대신 매칭되어, 실제 /purchases/new 페이지(new-purchase-form.tsx 포함)를
// 그대로 재사용하면서 목록 화면 위 모달로 띄운다.
export default async function InterceptedNewPurchasePage(props: {
  searchParams: Promise<{ supplier_id?: string; reorder_items?: string; saved?: string }>;
}) {
  return (
    <RegistrationModalShell>
      <NewPurchasePage {...props} />
    </RegistrationModalShell>
  );
}
