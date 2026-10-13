import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditSalePage from "@/app/(dashboard)/sales/[id]/edit/page";

// 인터셉트 라우트: 매출 상세/목록에서 수정으로 들어가면 실제
// /sales/[id]/edit 페이지를 그대로 재사용하면서 모달로 띄운다.
export default async function InterceptedEditSalePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  return (
    <RegistrationModalShell size="xl">
      <EditSalePage {...props} />
    </RegistrationModalShell>
  );
}
