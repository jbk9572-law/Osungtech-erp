import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { PurchaseQuoteRequestDetailPanel } from "@/components/purchase-quote-request-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function PurchaseQuoteRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchase-quote-requests" } }} />
      <PurchaseQuoteRequestDetailPanel id={id} closeHref="/purchase-quote-requests" />
    </div>
  );
}
