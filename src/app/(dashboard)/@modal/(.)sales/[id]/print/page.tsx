import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import SalesPrintPage from "@/app/(dashboard)/sales/[id]/print/page";
import { resolveListHref } from "@/lib/list-return";

// 인쇄 미리보기는 "보기 전용" 화면이라, 상세(수주상세) 모달을 거쳐
// 들어왔더라도 X로 닫으면 그 상세 모달을 다시 띄우지 않고 바로
// 목록까지 닫는다 — 수정 폼(edit)처럼 "닫으면 방금 보던 레코드로
// 돌아가야 하는" 화면이 아니기 때문(사용자 지적: 중첩 모달에서 X를
// 누르면 그냥 꺼져야지 이전 모달로 "뒤로가기" 하면 안 된다).
export default async function InterceptedSalesPrintPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string; lot?: string; back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell closeHref={resolveListHref("/sales", back)}>
      <SalesPrintPage {...props} />
    </RegistrationModalShell>
  );
}
