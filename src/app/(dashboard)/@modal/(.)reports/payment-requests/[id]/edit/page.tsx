import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditPaymentRequestPage from "@/app/(dashboard)/reports/payment-requests/[id]/edit/page";

export default async function InterceptedEditPaymentRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return (
    <RegistrationModalShell size="lg" closeHref={`/reports/payment-requests/${id}`}>
      <EditPaymentRequestPage {...props} />
    </RegistrationModalShell>
  );
}
