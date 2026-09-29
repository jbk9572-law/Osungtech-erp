import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { PurchaseRequestDetailPanel } from "@/components/purchase-request-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchase-requests" } }} />
      <PurchaseRequestDetailPanel id={id} closeHref="/purchase-requests" />
    </div>
  );
}
