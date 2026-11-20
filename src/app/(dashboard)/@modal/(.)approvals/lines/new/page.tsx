import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewApprovalLinePage from "@/app/(dashboard)/approvals/lines/new/page";

export default function InterceptedNewApprovalLinePage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/approvals/lines">
      <NewApprovalLinePage />
    </RegistrationModalShell>
  );
}
