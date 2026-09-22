import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewStockTransferPage from "@/app/(dashboard)/inventory/transfers/new/page";

export default async function InterceptedNewStockTransferPage() {
  return (
    <RegistrationModalShell size="lg">
      <NewStockTransferPage />
    </RegistrationModalShell>
  );
}
