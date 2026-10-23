import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchaseQuoteRequestDetailPage from "@/app/(dashboard)/purchase-quote-requests/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedPurchaseQuoteRequestDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/purchase-quote-requests", back)}>
      <PurchaseQuoteRequestDetailPage {...props} />
    </RegistrationModalShell>
  );
}
