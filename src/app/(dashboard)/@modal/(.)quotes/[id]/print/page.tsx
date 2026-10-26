import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import QuotePrintPage from "@/app/(dashboard)/quotes/[id]/print/page";
import { resolveBackHref } from "@/lib/list-return";

// 인쇄 미리보기는 보기 전용 화면이라, 상세 모달(또는 목록의 분할뷰)을
// 거쳐 들어왔어도 X로 닫으면 그 상세로 "뒤로가기"하지 않고 바로
// 목록까지 닫는다 — sales/[id]/print와 동일한 이유.
export default async function InterceptedQuotePrintPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell closeHref={resolveBackHref("/quotes", back)}>
      <QuotePrintPage {...props} />
    </RegistrationModalShell>
  );
}
