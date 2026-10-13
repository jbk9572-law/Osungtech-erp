import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PaymentRequestDetailPage from "@/app/(dashboard)/reports/payment-requests/[id]/page";

export default async function InterceptedPaymentRequestDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  return (
    <RegistrationModalShell size="lg" closeHref="/reports/payment-requests">
      <PaymentRequestDetailPage {...props} />
    </RegistrationModalShell>
  );
}
