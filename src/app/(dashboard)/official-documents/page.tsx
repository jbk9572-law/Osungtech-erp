import { OfficialDocumentsList } from "@/app/(dashboard)/official-documents/official-documents-list";

export default async function OfficialDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <OfficialDocumentsList box="mine" id={id} />;
}
