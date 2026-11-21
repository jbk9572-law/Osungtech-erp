import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewProductPage from "@/app/(dashboard)/products/new/page";

export default function InterceptedNewProductPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/products">
      <NewProductPage />
    </RegistrationModalShell>
  );
}
