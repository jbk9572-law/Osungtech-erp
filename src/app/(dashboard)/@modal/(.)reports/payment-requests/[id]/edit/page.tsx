import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditPaymentRequestPage from "@/app/(dashboard)/reports/payment-requests/[id]/edit/page";

export default async function InterceptedEditPaymentRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <EditPaymentRequestPage {...props} />
    </RegistrationModalShell>
  );
}
