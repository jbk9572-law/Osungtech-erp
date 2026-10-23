import { ApprovalDetailPanel } from "@/components/approval-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function ApprovalDocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/approvals", back);
  const selfHref = `/approvals/${id}${back ? `?back=${back}` : ""}`;

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <ApprovalDetailPanel id={id} closeHref={closeHref} selfHref={selfHref} />
    </div>
  );
}
