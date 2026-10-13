import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewPurchaseQuoteRequestPage from "@/app/(dashboard)/purchase-quote-requests/new/page";

export default async function InterceptedNewPurchaseQuoteRequestPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/purchase-quote-requests">
      <NewPurchaseQuoteRequestPage />
    </RegistrationModalShell>
  );
}
