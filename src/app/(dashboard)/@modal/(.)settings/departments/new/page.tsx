import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewDepartmentPage from "@/app/(dashboard)/settings/departments/new/page";

export default async function InterceptedNewDepartmentPage() {
  return (
    <RegistrationModalShell size="md">
      <NewDepartmentPage />
    </RegistrationModalShell>
  );
}
