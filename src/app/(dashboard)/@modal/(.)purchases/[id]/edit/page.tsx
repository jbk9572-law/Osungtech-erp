import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditPurchasePage from "@/app/(dashboard)/purchases/[id]/edit/page";

// 인터셉트 라우트: 매입 상세/목록에서 수정으로 들어가면 실제
// /purchases/[id]/edit 페이지를 그대로 재사용하면서 모달로 띄운다.
export default async function InterceptedEditPurchasePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  return (
    <RegistrationModalShell size="xl">
      <EditPurchasePage {...props} />
    </RegistrationModalShell>
  );
}
