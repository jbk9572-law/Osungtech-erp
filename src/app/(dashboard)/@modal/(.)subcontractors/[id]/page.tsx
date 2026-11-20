import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import SubcontractorDetailPage from "@/app/(dashboard)/subcontractors/[id]/page";

export default async function InterceptedSubcontractorDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <RegistrationModalShell size="lg" closeHref="/subcontractors">
      <SubcontractorDetailPage {...props} />
    </RegistrationModalShell>
  );
}
