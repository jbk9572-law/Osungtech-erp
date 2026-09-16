import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PaperCalcPage from "@/app/(dashboard)/paper-calc/page";

export default async function InterceptedPaperCalcPage(props: {
  searchParams: Promise<{ salesOrderId?: string; purchaseOrderId?: string; for?: string }>;
}) {
  return (
    <RegistrationModalShell>
      <PaperCalcPage {...props} />
    </RegistrationModalShell>
  );
}
