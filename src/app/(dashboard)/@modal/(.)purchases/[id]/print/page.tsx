import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchasePrintPage from "@/app/(dashboard)/purchases/[id]/print/page";
import { resolveListHref } from "@/lib/list-return";

// 인쇄 미리보기는 보기 전용 화면이라, 상세(발주상세) 모달을 거쳐
// 들어왔어도 X로 닫으면 그 상세로 "뒤로가기"하지 않고 바로 목록까지
// 닫는다 — sales/[id]/print와 동일한 이유.
export default async function InterceptedPurchasePrintPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string; lot?: string; back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell closeHref={resolveListHref("/purchases", back)}>
      <PurchasePrintPage {...props} />
    </RegistrationModalShell>
  );
}
