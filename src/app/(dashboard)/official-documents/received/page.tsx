import { OfficialDocumentsList } from "@/app/(dashboard)/official-documents/official-documents-list";

export default async function ReceivedOfficialDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string }>;
}) {
  const { id, status } = await searchParams;
  return <OfficialDocumentsList box="received" id={id} status={status} />;
}
