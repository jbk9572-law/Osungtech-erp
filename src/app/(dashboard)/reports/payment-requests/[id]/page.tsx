import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { PaymentRequestDetailPanel } from "@/components/payment-request-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function PaymentRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string; back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { warning, back } = await searchParams;
  const closeHref = resolveBackHref("/reports/payment-requests", back);
  const selfHref = `/reports/payment-requests/${id}${back ? `?back=${back}` : ""}`;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <PaymentRequestDetailPanel id={id} closeHref={closeHref} warning={warning} selfHref={selfHref} />
    </div>
  );
}
