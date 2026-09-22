import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import StockTransferDetailPage from "@/app/(dashboard)/inventory/transfers/[id]/page";

export default async function InterceptedStockTransferDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <StockTransferDetailPage {...props} />
    </RegistrationModalShell>
  );
}
