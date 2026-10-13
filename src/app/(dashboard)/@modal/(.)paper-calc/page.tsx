import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PaperCalcPage from "@/app/(dashboard)/paper-calc/page";

export default async function InterceptedPaperCalcPage(props: {
  searchParams: Promise<{ salesOrderId?: string; purchaseOrderId?: string; for?: string }>;
}) {
  const { salesOrderId, purchaseOrderId } = await props.searchParams;
  const closeHref = salesOrderId
    ? `/sales/${salesOrderId}`
    : purchaseOrderId
      ? `/purchases/${purchaseOrderId}`
      : "/dashboard";
  return (
    <RegistrationModalShell closeHref={closeHref}>
      <PaperCalcPage {...props} />
    </RegistrationModalShell>
  );
}
