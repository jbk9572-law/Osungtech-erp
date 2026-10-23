import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PaymentRequestDetailPage from "@/app/(dashboard)/reports/payment-requests/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedPaymentRequestDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string; back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/reports/payment-requests", back)}>
      <PaymentRequestDetailPage {...props} />
    </RegistrationModalShell>
  );
}
