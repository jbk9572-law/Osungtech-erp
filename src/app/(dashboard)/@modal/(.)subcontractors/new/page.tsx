import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewSubcontractorPage from "@/app/(dashboard)/subcontractors/new/page";

export default function InterceptedNewSubcontractorPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/subcontractors">
      <NewSubcontractorPage />
    </RegistrationModalShell>
  );
}
