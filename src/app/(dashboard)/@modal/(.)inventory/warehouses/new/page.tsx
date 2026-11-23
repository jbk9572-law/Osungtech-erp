import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewWarehousePage from "@/app/(dashboard)/inventory/warehouses/new/page";

export default function InterceptedNewWarehousePage() {
  return (
    <RegistrationModalShell size="md" closeHref="/inventory/warehouses">
      <NewWarehousePage />
    </RegistrationModalShell>
  );
}
