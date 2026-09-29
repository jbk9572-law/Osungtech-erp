import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { PaymentRequestDetailPanel } from "@/components/payment-request-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function PaymentRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { warning } = await searchParams;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/reports/payment-requests" } }} />
      <PaymentRequestDetailPanel id={id} closeHref="/reports/payment-requests" warning={warning} />
    </div>
  );
}
