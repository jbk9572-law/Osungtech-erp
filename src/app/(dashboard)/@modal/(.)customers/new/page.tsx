import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewCustomerPage from "@/app/(dashboard)/customers/new/page";

export default function InterceptedNewCustomerPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/customers">
      <NewCustomerPage />
    </RegistrationModalShell>
  );
}
