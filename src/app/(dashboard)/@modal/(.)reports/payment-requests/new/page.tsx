import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewPaymentRequestPage from "@/app/(dashboard)/reports/payment-requests/new/page";

export default async function InterceptedNewPaymentRequestPage() {
  return (
    <RegistrationModalShell size="lg">
      <NewPaymentRequestPage />
    </RegistrationModalShell>
  );
}
