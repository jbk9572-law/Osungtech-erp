import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import DocumentDetailPage from "@/app/(dashboard)/hr/documents/item/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedDocumentDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/hr/documents", back)}>
      <DocumentDetailPage {...props} />
    </RegistrationModalShell>
  );
}
