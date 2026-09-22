import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewQuotePage from "@/app/(dashboard)/quotes/new/page";

export default async function InterceptedNewQuotePage() {
  return (
    <RegistrationModalShell size="lg">
      <NewQuotePage />
    </RegistrationModalShell>
  );
}
