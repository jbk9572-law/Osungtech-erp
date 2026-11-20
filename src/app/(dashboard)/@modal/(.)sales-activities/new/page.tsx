import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewSalesActivityPage from "@/app/(dashboard)/sales-activities/new/page";

export default function InterceptedNewSalesActivityPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/sales-activities">
      <NewSalesActivityPage />
    </RegistrationModalShell>
  );
}
