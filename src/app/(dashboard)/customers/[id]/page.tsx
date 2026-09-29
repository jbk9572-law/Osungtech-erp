import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { CustomerDetailPanel } from "@/components/customer-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/customers" } }} />
      <CustomerDetailPanel id={id} />
    </div>
  );
}
