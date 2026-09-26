import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PurchasePrintPage from "@/app/(dashboard)/purchases/[id]/print/page";

export default async function InterceptedPurchasePrintPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string; lot?: string }>;
}) {
  return (
    <RegistrationModalShell>
      <PurchasePrintPage {...props} />
    </RegistrationModalShell>
  );
}
