import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import SalesActivityDetailPage from "@/app/(dashboard)/sales-activities/[id]/page";

export default async function InterceptedSalesActivityDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <RegistrationModalShell size="lg" closeHref="/sales-activities">
      <SalesActivityDetailPage {...props} />
    </RegistrationModalShell>
  );
}
