import { OfficialDocumentDetailPanel } from "@/components/official-document-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function OfficialDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/official-documents" } }} />
      <OfficialDocumentDetailPanel id={id} closeHref="/official-documents" />
    </div>
  );
}
