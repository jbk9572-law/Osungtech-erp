import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import DocumentDetailPage from "@/app/(dashboard)/hr/documents/[id]/page";

export default async function InterceptedDocumentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <DocumentDetailPage {...props} />
    </RegistrationModalShell>
  );
}
