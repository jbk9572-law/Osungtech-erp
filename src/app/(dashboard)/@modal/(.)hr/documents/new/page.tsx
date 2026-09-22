import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewDocumentPage from "@/app/(dashboard)/hr/documents/new/page";

export default async function InterceptedNewDocumentPage() {
  return (
    <RegistrationModalShell size="lg">
      <NewDocumentPage />
    </RegistrationModalShell>
  );
}
