import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import DocumentPrintPage from "@/app/(dashboard)/hr/documents/item/[id]/print/page";
import { resolveBackHref } from "@/lib/list-return";

// 보기 전용 인쇄 화면 — sales/[id]/print 등과 동일하게, 상세 모달을
// 거쳐 들어왔어도 X로 닫으면 상세로 "뒤로가기"하지 않고 목록까지 닫는다.
export default async function InterceptedDocumentPrintPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell closeHref={resolveBackHref("/hr/documents", back)}>
      <DocumentPrintPage {...props} />
    </RegistrationModalShell>
  );
}
