import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import DocumentPrintPage from "@/app/(dashboard)/hr/documents/item/[id]/print/page";

export default async function InterceptedDocumentPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return (
    <RegistrationModalShell closeHref={`/hr/documents/item/${id}`}>
      <DocumentPrintPage {...props} />
    </RegistrationModalShell>
  );
}
