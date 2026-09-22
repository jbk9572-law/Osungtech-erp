import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import DocumentPrintPage from "@/app/(dashboard)/hr/documents/[id]/print/page";

export default async function InterceptedDocumentPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell>
      <DocumentPrintPage {...props} />
    </RegistrationModalShell>
  );
}
