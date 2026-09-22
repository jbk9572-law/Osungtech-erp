import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchaseRequestDetailPage from "@/app/(dashboard)/purchase-requests/[id]/page";

export default async function InterceptedPurchaseRequestDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <PurchaseRequestDetailPage {...props} />
    </RegistrationModalShell>
  );
}
