import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import StockTransferDetailPage from "@/app/(dashboard)/inventory/transfers/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedStockTransferDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/inventory/warehouses", back)}>
      <StockTransferDetailPage {...props} />
    </RegistrationModalShell>
  );
}
