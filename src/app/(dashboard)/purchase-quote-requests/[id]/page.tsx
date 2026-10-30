import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { PurchaseQuoteRequestDetailPanel } from "@/components/purchase-quote-request-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function PurchaseQuoteRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/purchase-quote-requests", back);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <PurchaseQuoteRequestDetailPanel key={id} id={id} closeHref={closeHref} />
    </div>
  );
}
