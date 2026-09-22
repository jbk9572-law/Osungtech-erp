import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewPurchaseRequestPage from "@/app/(dashboard)/purchase-requests/new/page";

export default async function InterceptedNewPurchaseRequestPage(props: {
  searchParams: Promise<{ supplier_id?: string; reorder_items?: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <NewPurchaseRequestPage {...props} />
    </RegistrationModalShell>
  );
}
