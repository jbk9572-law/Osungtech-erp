import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import InventoryAdjustPage from "@/app/(dashboard)/inventory/adjust/page";

export default async function InterceptedInventoryAdjustPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/inventory">
      <InventoryAdjustPage />
    </RegistrationModalShell>
  );
}
