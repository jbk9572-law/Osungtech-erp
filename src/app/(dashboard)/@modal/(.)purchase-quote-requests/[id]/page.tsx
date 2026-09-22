import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchaseQuoteRequestDetailPage from "@/app/(dashboard)/purchase-quote-requests/[id]/page";

export default async function InterceptedPurchaseQuoteRequestDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <PurchaseQuoteRequestDetailPage {...props} />
    </RegistrationModalShell>
  );
}
