import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewDocumentTemplatePage from "@/app/(dashboard)/hr/documents/templates/new/page";

export default function InterceptedNewDocumentTemplatePage() {
  return (
    <RegistrationModalShell size="lg">
      <NewDocumentTemplatePage />
    </RegistrationModalShell>
  );
}
