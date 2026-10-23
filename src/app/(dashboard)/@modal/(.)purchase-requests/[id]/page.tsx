import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchaseRequestDetailPage from "@/app/(dashboard)/purchase-requests/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedPurchaseRequestDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/purchase-requests", back)}>
      <PurchaseRequestDetailPage {...props} />
    </RegistrationModalShell>
  );
}
