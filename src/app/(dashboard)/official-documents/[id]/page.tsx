import { OfficialDocumentDetailPanel } from "@/components/official-document-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function OfficialDocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/official-documents", back);
  const selfHref = `/official-documents/${id}${back ? `?back=${back}` : ""}`;

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <OfficialDocumentDetailPanel key={id} id={id} closeHref={closeHref} selfHref={selfHref} />
    </div>
  );
}
