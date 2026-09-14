import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewSalePage from "@/app/(dashboard)/sales/new/page";

// 인터셉트 라우트: /sales 목록에서 "새 거래 등록"으로 이동하면 이 경로가
// 대신 매칭되어, 실제 /sales/new 페이지(new-sale-form.tsx 포함)를 그대로
// 재사용하면서 목록 화면 위 모달로 띄운다. 새로고침/직접 URL 접근 시에는
// 인터셉트가 적용되지 않아 원래의 전체 화면 /sales/new가 그대로 열린다.
export default async function InterceptedNewSalePage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  return (
    <RegistrationModalShell>
      <NewSalePage {...props} />
    </RegistrationModalShell>
  );
}
