import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditDocumentTemplatePage from "@/app/(dashboard)/hr/documents/templates/[id]/edit/page";

export default async function InterceptedEditDocumentTemplatePage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <EditDocumentTemplatePage {...props} />
    </RegistrationModalShell>
  );
}
