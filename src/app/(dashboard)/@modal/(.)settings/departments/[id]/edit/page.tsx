import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditDepartmentPage from "@/app/(dashboard)/settings/departments/[id]/edit/page";

export default async function InterceptedEditDepartmentPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="md">
      <EditDepartmentPage {...props} />
    </RegistrationModalShell>
  );
}
