import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewApprovalDelegationPage from "@/app/(dashboard)/settings/delegations/new/page";

export default async function InterceptedNewApprovalDelegationPage() {
  return (
    <RegistrationModalShell size="md" closeHref="/settings/delegations">
      <NewApprovalDelegationPage />
    </RegistrationModalShell>
  );
}
