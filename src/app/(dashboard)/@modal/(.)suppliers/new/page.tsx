import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewSupplierPage from "@/app/(dashboard)/suppliers/new/page";

export default function InterceptedNewSupplierPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/suppliers">
      <NewSupplierPage />
    </RegistrationModalShell>
  );
}
