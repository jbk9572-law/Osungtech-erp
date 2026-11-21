import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewApprovalDocumentPage from "@/app/(dashboard)/approvals/new/page";

// 인터셉트 라우트: 기안함에서 [기안]·[이어 쓰기]를 누르면 /approvals/new 를 목록 위 C형 모달로 띄운다.
export default function InterceptedNewApprovalPage(props: { searchParams: Promise<{ draft?: string }> }) {
  return (
    <RegistrationModalShell size="lg" closeHref="/approvals">
      <NewApprovalDocumentPage {...props} />
    </RegistrationModalShell>
  );
}
