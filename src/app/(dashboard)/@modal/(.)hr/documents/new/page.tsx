import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewDocumentPage from "@/app/(dashboard)/hr/documents/new/page";

export default function InterceptedNewDocumentPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/hr/documents">
      <NewDocumentPage />
    </RegistrationModalShell>
  );
}
