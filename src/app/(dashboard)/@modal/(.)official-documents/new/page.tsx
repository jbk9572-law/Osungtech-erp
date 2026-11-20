import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewOfficialDocumentPage from "@/app/(dashboard)/official-documents/new/page";

export default function InterceptedNewOfficialDocumentPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/official-documents">
      <NewOfficialDocumentPage />
    </RegistrationModalShell>
  );
}
