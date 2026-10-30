import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { PurchaseRequestDetailPanel } from "@/components/purchase-request-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function PurchaseRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/purchase-requests", back);
  const selfHref = `/purchase-requests/${id}${back ? `?back=${back}` : ""}`;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <PurchaseRequestDetailPanel key={id} id={id} closeHref={closeHref} selfHref={selfHref} />
    </div>
  );
}
