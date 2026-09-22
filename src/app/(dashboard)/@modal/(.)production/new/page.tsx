import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewWorkOrderPage from "@/app/(dashboard)/production/new/page";

export default async function InterceptedNewWorkOrderPage() {
  return (
    <RegistrationModalShell size="lg">
      <NewWorkOrderPage />
    </RegistrationModalShell>
  );
}
