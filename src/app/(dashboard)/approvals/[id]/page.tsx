import { ApprovalDetailPanel } from "@/components/approval-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function ApprovalDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <ApprovalDetailPanel id={id} closeHref="/approvals" />
    </div>
  );
}
