import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewSupportTicketPage from "@/app/(dashboard)/settings/support/new/page";

export default function InterceptedNewSupportTicketPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/settings/support">
      <NewSupportTicketPage />
    </RegistrationModalShell>
  );
}
