import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import SalesPrintPage from "@/app/(dashboard)/sales/[id]/print/page";

export default async function InterceptedSalesPrintPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string; lot?: string }>;
}) {
  const { id } = await props.params;
  return (
    <RegistrationModalShell closeHref={`/sales/${id}`}>
      <SalesPrintPage {...props} />
    </RegistrationModalShell>
  );
}
